import { Queue, Worker, Job } from "bullmq";
import RedisConfig from "../config/redis.config";
import { emailService, SendEmailPayload } from "./email.service";
import { envConfig } from "../config/env.config";

export interface EmailJobData extends SendEmailPayload {
    jobId?: string;
    retryCount?: number;
}

class QueueService {
    private emailQueue: Queue;
    private worker: Worker | null = null;
    private readonly QUEUE_NAME = "email-queue";
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5000;

    constructor() {
        const connection = RedisConfig.getInstance();

        this.emailQueue = new Queue(this.QUEUE_NAME, {
            connection: {
                url: envConfig.REDIS_URL,
                maxRetriesPerRequest: null,
            },
            defaultJobOptions: {
                attempts: this.MAX_RETRIES,
                backoff: {
                    type: "fixed",
                    delay: this.RETRY_DELAY,
                },
                removeOnComplete: {
                    age: 3600,
                    count: 1000,
                },
                removeOnFail: {
                    age: 86400,
                    count: 10000,
                },
            },
        });

        this.initializeWorker();
    }

    private initializeWorker(): void {
        const connection = RedisConfig.getInstance();

        this.worker = new Worker(
            this.QUEUE_NAME,
            async (job: Job<EmailJobData>) => {
                console.log(`🔄 [WORKER] Processing job: ${job.id}`, {
                    to: Array.isArray(job.data.to) ? job.data.to.join(', ') : job.data.to,
                    subject: job.data.subject,
                    attempt: job.attemptsMade + 1
                });

                const result = await emailService.sendEmail(job.data);

                if (!result.success) {

                    throw new Error(result.error || "Email sending failed");
                }

                console.log(`✅ [WORKER] Job ${job.id} completed successfully`, {
                    messageId: result.messageId
                });

                return result;
            },
            {
                connection: {
                    url: envConfig.REDIS_URL,
                    maxRetriesPerRequest: null,
                },
                concurrency: 5,
                limiter: {
                    max: 10,
                    duration: 1000,
                },
            }
        );

        this.worker.on("completed", (job: Job<EmailJobData>) => {
            const jobData = job.data;
            const recipients = Array.isArray(jobData.to) ? jobData.to.join(", ") : jobData.to;
            console.log(`🎉 [WORKER] Job ${job.id} completed`, {
                to: recipients,
                subject: jobData.subject,
                duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 'N/A',
                timestamp: new Date().toISOString()
            });
        });

        this.worker.on("failed", (job: Job<EmailJobData> | undefined, error: Error) => {
            if (job) {
                const jobData = job.data;
                const recipients = Array.isArray(jobData.to) ? jobData.to.join(", ") : jobData.to;
                console.error(`💥 [WORKER] Job ${job.id} failed after ${job.attemptsMade} attempts`, {
                    to: recipients,
                    subject: jobData.subject,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.worker.on("error", (error: Error) => {

        });
    }

    async addEmailJob(emailData: SendEmailPayload): Promise<string> {
        const jobId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const jobData: EmailJobData = {
            ...emailData,
            jobId,
        };

        console.log(`📧 [QUEUE] Adding email job: ${jobId}`, {
            to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
            subject: emailData.subject,
            timestamp: new Date().toISOString()
        });

        const job = await this.emailQueue.add("send-email", jobData, {
            jobId,
            attempts: this.MAX_RETRIES,
        });


        return job.id || jobId;
    }

    async addBulkEmailJobs(emails: SendEmailPayload[]): Promise<{ jobIds: string[]; total: number }> {

        
        const jobIds: string[] = [];

        for (const email of emails) {
            const jobId = await this.addEmailJob(email);
            jobIds.push(jobId);
        }


        return {
            jobIds,
            total: jobIds.length,
        };
    }

    async getJobStatus(jobId: string): Promise<{
        status: string;
        data?: any;
        error?: string;
        attempts?: number;
    }> {

        const job = await this.emailQueue.getJob(jobId);

        if (!job) {

            return { status: "not_found" };
        }

        const state = await job.getState();
        const result = {
            status: state,
            attempts: job.attemptsMade,
        };

        if (state === "completed") {
            const returnValue = job.returnvalue;

            return { ...result, data: returnValue };
        }

        if (state === "failed") {
            const error = job.failedReason;

            return { ...result, error: error || undefined };
        }


        return result;
    }

    async getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }> {

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.emailQueue.getWaitingCount(),
            this.emailQueue.getActiveCount(),
            this.emailQueue.getCompletedCount(),
            this.emailQueue.getFailedCount(),
            this.emailQueue.getDelayedCount(),
        ]);


        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
        };
    }

    async cleanup(): Promise<void> {

        await this.emailQueue.obliterate({ force: true });

    }

    async close(): Promise<void> {

        await this.worker?.close();
        await this.emailQueue.close();

    }
}

export default new QueueService();