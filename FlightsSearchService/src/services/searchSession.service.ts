import { v4 as uuidv4 } from 'uuid';
import RedisCacheService from './redisCache.service';
import { AggregationResult } from '../utils/filter/flightAggregator';
import { envConfig } from '../config/env';
import { TripType } from '../utils/tripTypeDetector';

export interface SearchSession {
  id: string;
  timestamp: number;
  rawFlights: any[];
  aggregatedData: AggregationResult | null;
  searchParams: any;
  tripType: TripType;
  flightCount: number;
  lastAccessed: number;
}

export interface SearchSessionOptions {
  ttl?: number; // Time to live in seconds
  maxSessionsPerUser?: number;
}

export class SearchSessionManager {
  private readonly SESSION_PREFIX = 'flight_session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly DEFAULT_TTL = envConfig.REDIS.CACHE_TTL;
  private readonly MAX_SESSIONS_PER_USER = 5;

  /**
   * Create a new search session
   */
  async createSession(
    searchKey: string,
    userId: string,
    data: Omit<SearchSession, 'id' | 'timestamp' | 'lastAccessed'>,
    options?: SearchSessionOptions
  ): Promise<string> {
    const sessionId = uuidv4();
    const ttl = options?.ttl || this.DEFAULT_TTL;

    const session: SearchSession = {
      id: sessionId,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      ...data
    };

    // Store session data
    await RedisCacheService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      session,
      { ttl, prefix: '' }
    );

    // Store mapping from search key to session ID
    await RedisCacheService.set(
      `search_key:${searchKey}`,
      { sessionId, userId },
      { ttl, prefix: '' }
    );

    // Track user's sessions
    await this.addToUserSessions(userId, sessionId, ttl);

    // Clean up old sessions if exceeding limit
    await this.cleanupUserSessions(userId, options?.maxSessionsPerUser || this.MAX_SESSIONS_PER_USER);

    return sessionId;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SearchSession | null> {
    const session = await RedisCacheService.get<SearchSession>(
      `${this.SESSION_PREFIX}${sessionId}`,
      { prefix: '' }
    );

    if (session) {
      // Update last accessed time
      session.lastAccessed = Date.now();
      await this.updateSession(sessionId, session);
    }

    return session;
  }

  /**
   * Get session by search key
   */
  async getSessionBySearchKey(searchKey: string): Promise<SearchSession | null> {
    const mapping = await RedisCacheService.get<{ sessionId: string; userId: string }>(
      `search_key:${searchKey}`,
      { prefix: '' }
    );

    if (!mapping) return null;

    return this.getSession(mapping.sessionId);
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, session: SearchSession): Promise<boolean> {
    return RedisCacheService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      session,
      { ttl: this.DEFAULT_TTL, prefix: '' }
    );
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userId?: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (session && userId) {
      await this.removeFromUserSessions(userId, sessionId);
    }

    return RedisCacheService.delete(`${this.SESSION_PREFIX}${sessionId}`, { prefix: '' });
  }

  /**
   * Add session to user's session list
   */
  private async addToUserSessions(userId: string, sessionId: string, ttl: number): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await RedisCacheService.get<string[]>(userSessionsKey, { prefix: '' }) || [];

    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      await RedisCacheService.set(userSessionsKey, sessions, { ttl, prefix: '' });
    }
  }

  /**
   * Remove session from user's session list
   */
  private async removeFromUserSessions(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await RedisCacheService.get<string[]>(userSessionsKey, { prefix: '' }) || [];

    const updatedSessions = sessions.filter(id => id !== sessionId);
    if (updatedSessions.length > 0) {
      await RedisCacheService.set(userSessionsKey, updatedSessions, { ttl: this.DEFAULT_TTL, prefix: '' });
    } else {
      await RedisCacheService.delete(userSessionsKey, { prefix: '' });
    }
  }

  /**
   * Clean up old user sessions
   */
  private async cleanupUserSessions(userId: string, maxSessions: number): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await RedisCacheService.get<string[]>(userSessionsKey, { prefix: '' }) || [];

    if (sessions.length <= maxSessions) return;

    // Get all sessions with their timestamps
    const sessionDetails = await Promise.all(
      sessions.map(async (sessionId) => {
        const session = await this.getSession(sessionId);
        return { sessionId, timestamp: session?.timestamp || 0 };
      })
    );

    // Sort by timestamp (oldest first)
    sessionDetails.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest sessions
    const toDelete = sessionDetails.slice(0, sessions.length - maxSessions);
    for (const { sessionId } of toDelete) {
      await this.deleteSession(sessionId, userId);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SearchSession[]> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await RedisCacheService.get<string[]>(userSessionsKey, { prefix: '' }) || [];

    const sessions = await Promise.all(
      sessionIds.map(sessionId => this.getSession(sessionId))
    );

    return sessions.filter((session): session is SearchSession => session !== null);
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string): Promise<boolean> {
    return RedisCacheService.expire(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.DEFAULT_TTL,
      { prefix: '' }
    );
  }
}

export default new SearchSessionManager();