import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#12150f] p-6 text-[#eee6d2]">
      <div className="w-full max-w-md border border-[#3e4830] bg-[#182018] p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-8 w-8 text-[#c7ab63]" />
          <h1 className="text-2xl font-bold">404 Page Not Found</h1>
        </div>
        <p className="mt-4 text-sm text-[#a9aa91]">
          This challenge room does not have another page.
        </p>
      </div>
    </div>
  );
}
