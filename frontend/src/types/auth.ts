export interface LoginRequest {
  login: string;
  password: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
  mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
  newPasswordConfirm: string;
}
