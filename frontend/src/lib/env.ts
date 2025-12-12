/**
 * Centralized environment configuration for the frontend
 * This file provides a single source of truth for environment variables
 * and standardizes access patterns across the application.
 */

import { env as publicEnv } from '$env/dynamic/public';

// Development detection with multiple fallbacks
export const isDev = 
	publicEnv.PUBLIC_APP_ENV === 'development' ||
	(typeof window !== 'undefined' && window.location.hostname === 'localhost');

// Debug logging configuration
export const isDebugEnabled = 
	isDev ||
	publicEnv.PUBLIC_DEBUG_LOGS === '1' ||
	publicEnv.PUBLIC_DEBUG_LOGS === 'true';

// reCAPTCHA configuration
export const recaptcha = {
	siteKey: publicEnv.PUBLIC_RECAPTCHA_SITE_KEY || '',
	isConfigured: Boolean(publicEnv.PUBLIC_RECAPTCHA_SITE_KEY)
};

// API configuration
export const api = {
	baseUrl: publicEnv.PUBLIC_API_URL || 'http://localhost:3000',
	formSubmitUrl: publicEnv.PUBLIC_FORM_API_URL || '/api/interest/submit/'
};

// Application environment
export const app = {
	env: publicEnv.PUBLIC_APP_ENV || 'development',
	isDevelopment: isDev,
	isProduction: publicEnv.PUBLIC_APP_ENV === 'production',
	isBrowser: typeof window !== 'undefined'
};

// Debug logger factory
export const createLogger = (namespace: string) => {
	return {
		log: (...args: any[]) => {
			if (isDebugEnabled && typeof window !== 'undefined') {
				console.log(`[${namespace}]`, ...args);
			}
		},
		info: (...args: any[]) => {
			if (isDebugEnabled && typeof window !== 'undefined') {
				console.log(`[${namespace}]`, ...args);
			}
		},
		warn: (...args: any[]) => {
			if (typeof window !== 'undefined') {
				console.warn(`[${namespace}]`, ...args);
			}
		},
		error: (...args: any[]) => {
			if (typeof window !== 'undefined') {
				console.error(`[${namespace}]`, ...args);
			}
		},
		debug: (...args: any[]) => {
			if (isDebugEnabled && typeof window !== 'undefined') {
				console.log(`[${namespace}]`, ...args);
			}
		}
	};
};

// Environment info for debugging
export const getEnvInfo = () => ({
	PUBLIC_APP_ENV: publicEnv.PUBLIC_APP_ENV,
	PUBLIC_DEBUG_LOGS: publicEnv.PUBLIC_DEBUG_LOGS,
	PUBLIC_API_URL: publicEnv.PUBLIC_API_URL,
	PUBLIC_RECAPTCHA_SITE_KEY: publicEnv.PUBLIC_RECAPTCHA_SITE_KEY ? '[SET]' : '[NOT SET]',
	isDev,
	isDebugEnabled,
	isBrowser: typeof window !== 'undefined'
});

// Simple conditional logging for development
export const devLog = (...args: any[]) => {
	if (isDebugEnabled && typeof window !== 'undefined') {
		console.log(...args);
	}
};

export const devWarn = (...args: any[]) => {
	if (typeof window !== 'undefined') {
		console.warn(...args);
	}
};

export const devError = (...args: any[]) => {
	if (typeof window !== 'undefined') {
		console.error(...args);
	}
};

export default {
	isDev,
	isDebugEnabled,
	recaptcha,
	api,
	app,
	createLogger,
	getEnvInfo,
	devLog,
	devWarn,
	devError
};