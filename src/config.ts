export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
export const HAS_API_CONFIG = Boolean(API_BASE_URL);
