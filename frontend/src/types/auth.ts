export interface LoginRequest {
  email: string;
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
  needsPasswordChange: boolean;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
  newPasswordConfirm: string;
}
