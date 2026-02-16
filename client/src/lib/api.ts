import { API_BASE_URL } from './constants';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get(url: string) {
    const response = await fetch(this.baseURL + url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.handleResponse(response);
  }

  async post(url: string, data?: any) {
    const response = await fetch(this.baseURL + url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse(response);
  }

  async put(url: string, data?: any) {
    const response = await fetch(this.baseURL + url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse(response);
  }

  async delete(url: string) {
    const response = await fetch(this.baseURL + url, {
      method: 'DELETE',
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async upload(url: string, formData: FormData) {
    const response = await fetch(this.baseURL + url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'حدث خطأ');
    }
    return response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);