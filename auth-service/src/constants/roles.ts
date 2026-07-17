export enum Roles {
    USER = "USER",
    B2B_ADMIN = "B2B_ADMIN",
    AGENT = "AGENT",
    RM = "RM",
    /**
     * KLAR master. Configures the platform markup baked into the "api price"
     * every agent sees, and the B2C markup. Strictly more powerful than
     * B2B_ADMIN — holding it must never be inferable from clientType alone.
     * Gate with requireMaster, never with authorizeRoles alone: the role is
     * necessary but not sufficient (see master.middleware).
     */
    MASTER = "MASTER",
}
