import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
      <SignUp forceRedirectUrl="/" />
    </div>
  );
}
