import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.config';
import { EmailOptions } from '../config/email.config';

export interface EmailJobData {
    dbId: string;
    trackingId: string;
    options: EmailOptions;
}

export const EMAIL_QUEUE_NAME = 'email-queue';

export const defaultJobOptions: JobsOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions,
});

emailQueue.on('error', (err) => {
    console.error('[BullMQ Queue Error]:', err.message);
});

export const enqueueEmailJob = async (jobData: EmailJobData, customOptions?: JobsOptions) => {
    const job = await emailQueue.add(`send-email-${jobData.trackingId}`, jobData, {
        ...defaultJobOptions,
        ...customOptions,
    });

    return {
        jobId: job.id,
        trackingId: jobData.trackingId,
        dbId: jobData.dbId,
    };
};

export const enqueueBulkEmailJobs = async (bulkJobs: EmailJobData[]) => {
    const jobsToEnqueue = bulkJobs.map((data) => ({
        name: `send-email-${data.trackingId}`,
        data,
        opts: { ...defaultJobOptions },
    }));

    const queuedJobs = await emailQueue.addBulk(jobsToEnqueue);

    return queuedJobs.map((job, idx) => ({
        jobId: job.id,
        trackingId: bulkJobs[idx].trackingId,
        dbId: bulkJobs[idx].dbId,
    }));
};

export const getEmailQueueMetrics = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        emailQueue.getWaitingCount(),
        emailQueue.getActiveCount(),
        emailQueue.getCompletedCount(),
        emailQueue.getFailedCount(),
        emailQueue.getDelayedCount(),
    ]);

    return {
        queueName: EMAIL_QUEUE_NAME,
        counts: {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
        },
    };
};

export const getJobById = async (jobId: string) => {
    const job = await emailQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress: job.progress,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
    };
};

export const closeEmailQueue = async () => {
    try {
        await Promise.race([
            emailQueue.close(),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
    } catch (err) {
        // ignore timeout/error during force close
    }
};
