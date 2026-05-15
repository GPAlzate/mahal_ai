import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
      <SignIn forceRedirectUrl="/" />
    </div>
  );
}
