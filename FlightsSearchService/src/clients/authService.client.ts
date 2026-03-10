import axios, { AxiosInstance } from 'axios';
import { TokenValidationResponse, ValidatedUser } from '../interface/flight/authServiceClient.interface';



export class AuthServiceClient {
    private client: AxiosInstance;
    private static instance: AuthServiceClient;

    private constructor(baseURL: string) {
        this.client = axios.create({
            baseURL,
            timeout: 5000, 
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    public static getInstance(baseURL: string): AuthServiceClient {
        if (!AuthServiceClient.instance) {
            AuthServiceClient.instance = new AuthServiceClient(baseURL);
        }
        return AuthServiceClient.instance;
    }

    /**
     * Validate token and get user details
     * @param token - JWT token from the request
     * @returns Validated user information
     */
    async validateToken(token: string): Promise<ValidatedUser> {
        try {
            const response = await this.client.post<TokenValidationResponse>(
                '/auth/validate-token',
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.data.success) {
                throw new Error(response.data.message || 'Token validation failed');
            }

            return response.data.data;
        } catch (error: any) {
            if (error.response?.data) {
                throw new Error(error.response.data.message || 'Token validation failed');
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Auth service unavailable');
            }
            throw new Error('Failed to validate token');
        }
    }
}