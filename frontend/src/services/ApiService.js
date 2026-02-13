const API_URL = process.env.REACT_APP_BACKEND_URL;

class ApiService {
  static getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  static async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const config = {
      ...options,
      credentials: 'include', // Include httpOnly cookies
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
      // Token expired or invalid (httpOnly cookie)
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    // Read the response body once and reuse it
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { detail: 'Invalid response format' };
    }

    if (!response.ok) {
      throw new Error(data.detail || 'Request failed');
    }

    return data;
  }

  // Claims API
  static async getClaims(status = null) {
    const query = status && status !== 'All' ? `?filter_status=${encodeURIComponent(status)}` : '';
    return this.request(`/api/claims/${query}`);
  }

  static async getClaim(claimId) {
    return this.request(`/api/claims/${claimId}`);
  }

  static async getFloridaClaimReadiness(claimId) {
    return this.request(`/api/claims/${claimId}/florida-readiness`);
  }

  static async getDemandPackageManifest(claimId) {
    return this.request(`/api/claims/${claimId}/demand-package-manifest`);
  }

  static async getClaimCopilotActions(claimId) {
    return this.request(`/api/ai/claims/${claimId}/copilot-next-actions`, {
      method: 'POST',
    });
  }

  static async getClaimCommsCopilot(claimId, payload = {}) {
    return this.request(`/api/ai/claims/${claimId}/comms-copilot`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async createClaim(claimData) {
    return this.request('/api/claims/', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }

  static async updateClaim(claimId, updates) {
    return this.request(`/api/claims/${claimId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  static async deleteClaim(claimId) {
    return this.request(`/api/claims/${claimId}`, {
      method: 'DELETE',
    });
  }

  // Notes API
  static async getClaimNotes(claimId) {
    return this.request(`/api/claims/${claimId}/notes`);
  }

  static async addClaimNote(claimId, content, tags = []) {
    return this.request(`/api/claims/${claimId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ claim_id: claimId, content, tags }),
    });
  }

  // Documents API
  static async getClaimDocuments(claimId) {
    return this.request(`/api/claims/${claimId}/documents`);
  }

  static async uploadDocument(claimId, file, docType = 'General') {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const response = await fetch(`${API_URL}/api/claims/${claimId}/documents`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    // Read the response body once and reuse it
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { detail: 'Invalid response format' };
    }

    if (!response.ok) {
      throw new Error(data.detail || 'Upload failed');
    }

    return data;
  }

  // Dashboard Stats (calculated from claims)
  static async getDashboardStats() {
    const claims = await this.getClaims();
    
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const stats = {
      totalClaims: claims.length,
      activeClaims: claims.filter(c => !['Completed', 'Closed'].includes(c.status)).length,
      completedThisMonth: claims.filter(c => {
        const createdAt = new Date(c.created_at);
        return c.status === 'Completed' && 
               createdAt.getMonth() === thisMonth && 
               createdAt.getFullYear() === thisYear;
      }).length,
      pendingInspections: claims.filter(c => c.status === 'Under Review').length,
      totalValue: claims.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
      avgProcessingTime: '12 days', // Would need more data to calculate
      recentClaims: claims.slice(0, 4),
    };
    
    return stats;
  }

  // Notifications API
  static async getNotifications(unreadOnly = false, limit = 50) {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unread_only', 'true');
    if (limit) params.append('limit', limit.toString());
    return this.request(`/api/notifications/?${params.toString()}`);
  }

  static async getUnreadCount() {
    return this.request('/api/notifications/unread-count');
  }

  static async markNotificationAsRead(notificationId) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  static async markAllNotificationsAsRead() {
    return this.request('/api/notifications/read-all', {
      method: 'PUT',
    });
  }

  // Payments API
  static async createCheckoutSession(packageId) {
    const originUrl = window.location.origin;
    return this.request('/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({
        package_id: packageId,
        origin_url: originUrl,
      }),
    });
  }

  static async getPaymentStatus(sessionId) {
    return this.request(`/api/payments/status/${sessionId}`);
  }

  static async getSubscription() {
    return this.request('/api/payments/subscription');
  }

  static async getPaymentPackages() {
    return this.request('/api/payments/packages');
  }
}

export default ApiService;
