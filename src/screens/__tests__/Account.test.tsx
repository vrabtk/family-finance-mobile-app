import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { AuthScreen } from '../AuthScreen';
import { phoneProblem, ProfileScreen } from '../ProfileScreen';

jest.mock('../../api');
jest.mock('../../config', () => ({ API_BASE_URL: 'https://api.test/api/v1', HAS_API_CONFIG: true }));

const mockPatch = jest.fn(async () => {});
jest.mock('../../session', () => ({
  useSession: () => ({
    session: { user: { id: 'u1', name: 'Asha', email: 'a@x.com', phone: null } },
    patchSession: mockPatch, signIn: jest.fn(), signUp: jest.fn(),
  }),
  errorMessage: (e: any, f = 'Something went wrong.') => e?.message || f,
}));

jest.setTimeout(20000);
const api = jest.mocked(apiModule) as any;
beforeEach(() => jest.clearAllMocks());

describe('phone rule', () => {
  test('optional, 7 to 15 digits, + and separators allowed', () => {
    expect(phoneProblem('')).toBe('');
    expect(phoneProblem('+91 98765-43210')).toBe('');
    expect(phoneProblem('12345')).not.toBe('');
    expect(phoneProblem('12ab5678')).not.toBe('');
  });
});

describe('profile', () => {
  test('saves name and phone and updates the session', async () => {
    api.updateProfile.mockResolvedValue({ user: { id: 'u1', name: 'Asha K', email: 'a@x.com', phone: '+919876543210' } });
    render(<ProfileScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Name'), 'Asha K');
    fireEvent.changeText(screen.getByLabelText('Mobile number (optional)'), '+91 98765 43210');
    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Asha K', phone: '+91 98765 43210' }));
    await screen.findByText('Profile saved.');
    expect(mockPatch).toHaveBeenCalled();
  });

  test('an empty phone is sent as null; a bad one is stopped before the server', async () => {
    api.updateProfile.mockResolvedValue({ user: { id: 'u1', name: 'Asha', email: 'a@x.com', phone: null } });
    render(<ProfileScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Mobile number (optional)'), '123');
    fireEvent.press(screen.getByText('Save changes'));
    await screen.findByText('Enter 7 to 15 digits, or leave it empty.');
    expect(api.updateProfile).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Mobile number (optional)'), '');
    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Asha', phone: null }));
  });

  test('change password checks the form, then stores the new tokens', async () => {
    api.changePassword.mockResolvedValue({ message: 'ok', accessToken: 'A2', refreshToken: 'R2' });
    render(<ProfileScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Current password'), 'old-password');
    fireEvent.changeText(screen.getByLabelText('New password'), 'new-password-1');
    fireEvent.changeText(screen.getByLabelText('Repeat new password'), 'different-1');
    fireEvent.press(screen.getByText('Change password'));
    await screen.findByText('The two new passwords do not match.');
    expect(api.changePassword).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Repeat new password'), 'new-password-1');
    fireEvent.press(screen.getByText('Change password'));
    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith('old-password', 'new-password-1'));
    expect(mockPatch).toHaveBeenCalledWith({ accessToken: 'A2', refreshToken: 'R2' });
    await screen.findByText(/Other devices were signed out/);
  });

  test('shows the server message when the current password is wrong', async () => {
    api.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
    render(<ProfileScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Current password'), 'nope-nope');
    fireEvent.changeText(screen.getByLabelText('New password'), 'new-password-1');
    fireEvent.changeText(screen.getByLabelText('Repeat new password'), 'new-password-1');
    fireEvent.press(screen.getByText('Change password'));
    await screen.findByText('Current password is incorrect');
  });
});

describe('forgot password', () => {
  const openForgot = () => { render(<AuthScreen />); fireEvent.press(screen.getByText('Forgot password?')); };

  test('asks for a code by email, then resets with the code and a new password', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'If that email has an account, a 6-digit code has been sent to it.' });
    api.resetPassword.mockResolvedValue({ message: 'Password changed. Sign in with your new password.' });
    openForgot();
    fireEvent.changeText(screen.getByLabelText('Email'), 'a@x.com');
    fireEvent.press(screen.getByText('Send code'));
    await waitFor(() => expect(api.forgotPassword).toHaveBeenCalledWith('a@x.com'));
    fireEvent.changeText(await screen.findByLabelText('6-digit code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'brand-new-pass');
    fireEvent.press(screen.getByText('Change password'));
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith('a@x.com', '123456', 'brand-new-pass'));
    await screen.findByText('Password changed. Sign in with your new password.');
    expect(screen.getByText('Forgot password?')).toBeTruthy(); // back on the sign-in form
  });

  test('refuses a malformed code or short password before calling the server', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'sent' });
    openForgot();
    fireEvent.changeText(screen.getByLabelText('Email'), 'a@x.com');
    fireEvent.press(screen.getByText('Send code'));
    fireEvent.changeText(await screen.findByLabelText('6-digit code'), '12');
    fireEvent.changeText(screen.getByLabelText('New password'), 'brand-new-pass');
    fireEvent.press(screen.getByText('Change password'));
    await screen.findByText('Enter the 6-digit code from the email.');
    fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    fireEvent.press(screen.getByText('Change password'));
    await screen.findByText('Password must be at least 8 characters.');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  test('shows a wrong-code error from the server and can go back', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'sent' });
    api.resetPassword.mockRejectedValue(new Error('Invalid or expired code'));
    openForgot();
    fireEvent.changeText(screen.getByLabelText('Email'), 'a@x.com');
    fireEvent.press(screen.getByText('Send code'));
    fireEvent.changeText(await screen.findByLabelText('6-digit code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'brand-new-pass');
    fireEvent.press(screen.getByText('Change password'));
    await screen.findByText('Invalid or expired code');
    fireEvent.press(screen.getByText('Back to sign in'));
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });
});
