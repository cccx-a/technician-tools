import type { Vehicle, HistoryLog, AuthResponse, PaginatedResponse, User } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Liftngo URL for redirects and authentication
// Use VITE_LIFTNGO_URL env variable (add to .env file)
export const LIFTNGO_URL = import.meta.env.VITE_LIFTNGO_URL || 'https://liftngo.tmh-wst.com';

// Liftngo API URL (same as LIFTNGO_URL for now, but can be different if needed)
const LIFTNGO_API_URL = LIFTNGO_URL;

// Cookie helper functions - exported for use in other components
export const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
};

export const setCookie = (name: string, value: string, days: number = 7): void => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    // Use SameSite=Lax for subdomain compatibility, Secure for HTTPS
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    // Use parent domain .tmh-wst.com to override Liftngo's tsm cookie
    const domain = window.location.hostname.includes('tmh-wst.com') ? '; domain=.tmh-wst.com' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/${secure}${domain}; SameSite=Lax`;
};

export const removeCookie = (name: string): void => {
    // Remove from both current domain and parent domain
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    // Also try to remove from parent domain
    if (window.location.hostname.includes('tmh-wst.com')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.tmh-wst.com`;
    }
};

const getHeaders = () => {
    const token = getCookie('tsm');
    // Ensure we don't send "undefined" or "null" strings as tokens
    const validToken = token && token !== 'undefined' && token !== 'null' && token !== 'cookie-auth';
    return {
        'Content-Type': 'application/json',
        ...(validToken ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async (response: Response) => {
    if (response.status === 401) {
        // Session expired or invalid token
        // Don't auto-redirect here - it causes loops when combined with SSO
        // Instead, throw an error and let the caller/component handle it
        console.warn('API returned 401 Unauthorized - token may be invalid');

        // Only remove cookie and redirect if we're NOT in an SSO flow
        // Check if this looks like a fresh SSO attempt
        const currentToken = getCookie('tsm');
        const isLiftngoToken = currentToken && /^\d+\|/.test(currentToken);

        if (isLiftngoToken) {
            // This is still a Liftngo token - SSO might have failed silently
            console.warn('Still have Liftngo token after 401 - SSO may need retry');
            throw new Error('SSO token not valid for API');
        }

        // Session expired - redirect to login without removing parent domain cookies
        console.warn('Session expired, redirecting to login...');
        // Note: Don't removeCookie here - cookies belong to Liftngo parent domain
        localStorage.removeItem('user');
        window.location.replace('/login');

        // Throwing error to interrupt the promise chain
        throw new Error('Session expired');
    }
    if (!response.ok) {
        throw new Error(response.statusText || 'API request failed');
    }
    return response;
};

export const api = {
    login: async (username: string, password: string): Promise<AuthResponse> => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();

        if (!data.access_token) {
            throw new Error('Invalid server response: No access token received');
        }

        // The API returns { access_token: string }, we map it to our AuthResponse
        // We might need to fetch user details separately or decode the token if the API doesn't return user info.
        // For now, let's assume we construct a basic user object or the API returns it.
        // Based on Postman, it returns access_token. We'll mock the User object for now or extract from token.
        return {
            token: data.access_token,
            user: {
                id: data.user?.id || 1, // Use data.user if available, otherwise placeholder
                name: data.user?.name || username,
                email: data.user?.email || '',
                role_id: data.user?.role_id || data.role_id || 1,
                firstname: data.user?.firstname || 'Technician',
                lastname: data.user?.lastname || 'User',
                titlename: data.user?.titlename || 'Mr.',
                token: data.access_token
            }
        };
    },

    getVehicles: async (page = 1, limit = 8, search = ''): Promise<PaginatedResponse<Vehicle>> => {
        // Use the endpoint provided by the user
        const response = await fetch(`${BASE_URL}/technician/fleet-boxes?page=${page}&limit=${limit}&search=${search}`, {
            headers: getHeaders(),
        }).then(handleResponse);

        // handleResponse throws if !ok, so we can safely get json here

        const json = await response.json();
        const items = json.data || [];
        const meta = json.meta || { total: 0, page: 1, limit: limit, totalPages: 1 };

        // Map API response to Vehicle interface
        const vehicles = items.map((item: any) => ({
            id: item.fp_id || item.fb_id, // Use fp_id (Fleet Product) as primary ID, fallback to fb_id
            fb_id: item.fleet_box?.fb_id || item.fb_id,
            fp_id: item.fp_id,
            m_id: item.m_id || item.matching?.m_id, // Add m_id from response or matching object
            serial_number: item.serial_number, // Product Serial Number
            box_serial_number: item.fleet_box?.serial_number, // Control Box Serial Number
            model: item.product_name || item.fleet_product?.product_name || 'Unknown Model',
            model_code: item.model_code?.toString() || item.model?.toString() || '0',
            status: item.status === 1 ? 'active' : item.status === 2 ? 'maintenance' : 'inactive',
            battery_level: item.battery || item.fleet_product?.battery || 100,
            last_maintenance: item.updated_at || new Date().toISOString(),
            product_id: item.product_id,
            product_name: item.product_name,
            location: item.location,
            matching: item.matching, // Include full matching object
            match_process: item.match_process,
            fleet_box: item.fleet_box, // Include full fleet_box object
            fleet_product: {
                fleet_name: item.fleet_name || item.fleet_product?.fleet_name,
                serial_number: item.serial_number,
                model_info: {
                    id: item.product_id,
                    name: item.product_name
                }
            },
            image: 'https://images.unsplash.com/photo-1532906619279-a7826040495f?auto=format&fit=crop&w=300&q=80' // Placeholder
        }));

        return { data: vehicles, meta };
    },

    getHistory: async (page = 1, limit = 10, startDate = '', endDate = '', search = ''): Promise<PaginatedResponse<HistoryLog>> => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });

        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (search) params.append('search', search);

        const url = `${BASE_URL}/technician/history?${params.toString()}`;
        // console.log('Fetching history from:', url);

        // console.log('Fetching history from:', url);

        try {
            const response = await fetch(url, {
                headers: getHeaders(),
            }).then(handleResponse);

            const data = await response.json();
            // console.log('History data:', data);
            return data;
        } catch (error) {
            console.warn('Failed to fetch history:', error);
            // If session expired, handleResponse would have thrown and redirected. 
            // If we catch it here, we might swallow the redirection if logic continues? 
            // handleResponse throws ERROR.
            // But we should propagate the error if it's session expired so the UI knows or just let the redirect happen.
            if (error instanceof Error && error.message === 'Session expired') {
                throw error;
            }
            return { data: [], meta: { total: 0, page: 1, limit: limit, totalPages: 1 } };
        }
    },

    // Helper function to avoid 'response' shadowing issues if we were to restructure differently,
    // but the above try/catch block replaces lines 98-109 cleanly.

    logAction: async (action: string, details: string, fb_id?: number, fp_id?: number): Promise<void> => {
        try {
            await fetch(`${BASE_URL}/technician/log`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ action, details, fb_id, fp_id })
            }).then(handleResponse);
        } catch (error) {
            console.error('Failed to log action', error);
        }
    },

    approveVehicle: async (
        vehicleId: number | string,
        serialNumber: string,
        mId?: number | string,
        fbId?: number,
        fpId?: number
    ): Promise<void> => {
        try {
            // Get user role from localStorage
            const userJson = localStorage.getItem('user');
            const user = userJson ? JSON.parse(userJson) : null;
            const userRoleId = user?.role_id || 18; // Fallback to 18 if not found

            // Call external Liftngo API to approve/prove matching
            const formData = new FormData();
            formData.append('m_id', String(mId || vehicleId));
            formData.append('matching_process', '3');
            formData.append('role', String(userRoleId));

            console.log('Approving vehicle:', vehicleId, serialNumber, mId, fbId, fpId, userRoleId);
            const externalResponse = await fetch(`${LIFTNGO_URL}/api/prove_matching`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                },
                body: formData
            });

            if (!externalResponse.ok) {
                const errorText = await externalResponse.text();
                throw new Error(`External API error: ${externalResponse.status} - ${errorText}`);
            }

            // After successful external API call, log to history
            await api.logAction(
                'QC_APPROVE',
                `QC Approved vehicle ${serialNumber} (ID: ${vehicleId})`,
                fbId,
                fpId
            );

        } catch (error) {
            console.error('Failed to approve vehicle:', error);
            throw error;
        }
    },

    // SSO Login with Liftngo token
    // Sends the tsm token to backend, which validates with Liftngo API
    // and returns a local JWT for subsequent API calls
    ssoLogin: async (liftngoToken: string): Promise<AuthResponse> => {
        const response = await fetch(`${BASE_URL}/auth/sso/liftngo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: liftngoToken }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'SSO login failed');
        }

        const data = await response.json();

        if (!data.access_token) {
            throw new Error('Invalid server response: No access token received');
        }

        return {
            token: data.access_token,
            user: {
                id: data.user?.id || 0,
                name: data.user?.name || '',
                email: data.user?.email || '',
                role_id: data.user?.role_id || 1,
                firstname: data.user?.firstname || '',
                lastname: data.user?.lastname || '',
                titlename: data.user?.titlename || '',
            }
        };
    },

    // SSO Login with Laravel encrypted cookies
    // Sends both tsm and liftngo_session cookies to backend
    // Backend validates with Liftngo API server-side and returns local JWT
    ssoCookieLogin: async (tsmCookie: string, liftngoSession: string): Promise<AuthResponse> => {
        const response = await fetch(`${BASE_URL}/auth/sso/cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tsm: tsmCookie,
                liftngo_session: liftngoSession
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Cookie SSO login failed');
        }

        const data = await response.json();

        if (!data.access_token) {
            throw new Error('Invalid server response: No access token received');
        }

        return {
            token: data.access_token,
            user: {
                id: data.user?.id || 0,
                name: data.user?.name || '',
                email: data.user?.email || '',
                role_id: data.user?.role_id || 1,
                firstname: data.user?.firstname || '',
                lastname: data.user?.lastname || '',
                titlename: data.user?.titlename || '',
            }
        };
    },

    // Legacy: Cookie-based authentication using tsm cookie from parent domain (liftngo)
    // Note: This is deprecated, use ssoLogin instead
    loginWithCookie: async (): Promise<AuthResponse | null> => {
        try {
            const response = await fetch(`${LIFTNGO_API_URL}/api/tech/profile`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include', // Important: This sends cookies with the request
            });

            if (!response.ok) {
                console.warn('Cookie authentication failed:', response.status);
                return null;
            }

            const data = await response.json();

            // API returns { user: { ... } } format
            const userData = data.user;

            if (!userData) {
                console.warn('Cookie authentication failed: No user data in response');
                return null;
            }

            // Map the API response to our User format
            const user: User = {
                id: userData.id,
                name: userData.name || '',
                email: userData.email || '',
                role_id: userData.role_id || 1,
                firstname: userData.firstname || '',
                lastname: userData.lastname || '',
                titlename: userData.titlename || '',
            };

            // For cookie-based auth, we don't get a separate token
            // We'll use a special marker to indicate cookie-based session
            return {
                token: 'cookie-auth', // Marker to indicate cookie-based authentication
                user: user,
            };
        } catch (error) {
            console.warn('Cookie authentication error:', error);
            return null;
        }
    },

    // Check if tsm cookie exists (basic check)
    hasTsmCookie: (): boolean => {
        // Note: We can only check cookies that are not HttpOnly
        // If tsm is HttpOnly, this check won't work and we'll need to try the API call
        const cookies = document.cookie.split(';');
        return cookies.some(cookie => cookie.trim().startsWith('tsm='));
    },

    // Logout function - calls API and removes local session
    logout: async (): Promise<void> => {
        try {
            // Use the original Liftngo token (saved during SSO) for logout API
            const liftngoToken = localStorage.getItem('liftngo_token');
            const currentToken = getCookie('tsm');

            // Prefer Liftngo token, fallback to current token if it looks like a Liftngo token
            const tokenForLogout = liftngoToken || (currentToken && /^\d+\|/.test(currentToken) ? currentToken : null);

            if (tokenForLogout) {
                console.log('Calling Liftngo logout API...');
                // Call the logout API with cookies
                await fetch(`${LIFTNGO_API_URL}/api/tech/logout`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${tokenForLogout}`,
                    },
                    credentials: 'include', // Send cookies (liftngo_session) with the request
                });
                console.log('Liftngo logout API called successfully');
            } else {
                console.warn('No valid Liftngo token found for logout API');
            }
        } catch (error) {
            console.warn('Logout API call failed:', error);
        } finally {
            // Always remove local session data regardless of API call result
            removeCookie('tsm');
            localStorage.removeItem('user');
            localStorage.removeItem('liftngo_token');
        }
    }
};
