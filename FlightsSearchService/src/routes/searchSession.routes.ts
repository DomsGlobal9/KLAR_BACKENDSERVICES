import { Router } from "express";
import {
    createSearchSession,
    getSearchSession,
    getUserSearchSessions,
    deleteSearchSession,
    extendSearchSession,
} from "../controllers/searchSessionController";

const router = Router();

/**
 * @route   POST /api/search-sessions
 * @desc    Create a new search session
 * @access  Public (guests allowed)
 */
router.post("/", createSearchSession);

/**
 * @route   GET /api/search-sessions/user/:userId
 * @desc    Get all search sessions for a user
 * @access  Private (should add auth middleware)
 */
router.get("/user/:userId", getUserSearchSessions);

/**
 * @route   GET /api/search-sessions/:sessionId
 * @desc    Get search session by ID
 * @access  Public
 */
router.get("/:sessionId", getSearchSession);

/**
 * @route   DELETE /api/search-sessions/:sessionId
 * @desc    Delete a search session
 * @access  Private (should add auth middleware)
 */
router.delete("/:sessionId", deleteSearchSession);

/**
 * @route   PATCH /api/search-sessions/:sessionId/extend
 * @desc    Extend search session expiry
 * @access  Public
 */
router.patch("/:sessionId/extend", extendSearchSession);

export default router;
