const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
export const BACKEND_URL = rawUrl.replace(/\/api$/, '');

export const API_ENDPOINTS = {
    SYNC_REGISTER: `${BACKEND_URL}/api/sync/register`,
    SYNC_DEPOSIT: `${BACKEND_URL}/api/sync/deposit`,
    SYNC_WITHDRAW: `${BACKEND_URL}/api/sync/withdraw`,
    SYNC_LUCKY_BUY: `${BACKEND_URL}/api/sync/lucky-buy`,
    SYNC_BET: `${BACKEND_URL}/api/sync/bet`,
    SYNC_WIN: `${BACKEND_URL}/api/sync/win`,
    SYNC_CONVERT: `${BACKEND_URL}/api/sync/convert`,
    SYNC_REWARD: `${BACKEND_URL}/api/sync/reward`,
    SYNC_INCOME: `${BACKEND_URL}/api/sync/income`,
    GET_TEAM_STATS: (address: string) => `${BACKEND_URL}/api/team/${address}`,
    GET_HISTORY: (address: string) => `${BACKEND_URL}/api/history/${address}`,
    GET_ADMIN_HISTORY: `${BACKEND_URL}/api/admin/history`,
    GET_LUCKY_STATS: `${BACKEND_URL}/api/lucky/stats`,
    GET_ROUNDS: `${BACKEND_URL}/api/rounds`,
    GET_ADMIN_USERS: `${BACKEND_URL}/api/admin/users`,
    GET_ADMIN_ANALYTICS: `${BACKEND_URL}/api/admin/analytics`,
    GET_ADMIN_DISTRIBUTIONS: `${BACKEND_URL}/api/admin/distributions`,
    GET_ADMIN_GAME_STATUS: `${BACKEND_URL}/api/admin/game-status`,
    GET_ADMIN_OVERVIEW_NORMALIZED: `${BACKEND_URL}/api/admin/overview-normalized`,
    ADMIN_SOFT_RESET_SNAPSHOT: `${BACKEND_URL}/api/admin/soft-reset/snapshot`,
    GET_DRAWS: `${BACKEND_URL}/api/draws`,
};
