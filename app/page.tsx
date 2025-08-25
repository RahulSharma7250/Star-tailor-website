import { LoginForm } from "@/components/login-form"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-100 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 border-2 border-violet-300 rounded-full"></div>
        <div className="absolute top-32 right-20 w-24 h-24 border border-purple-300 rounded-lg rotate-45"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 border border-violet-200 rounded-full"></div>
        <div className="absolute bottom-32 right-32 w-16 h-16 border-2 border-purple-400 rounded-lg rotate-12"></div>
      </div>

      <div className="flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
            <div className="text-center space-y-8">
              <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-5xl font-bold mb-4 stitch-animation">STAR TAILORS</h1>
                <p className="text-xl font-medium mb-6 text-violet-100">Craftsmanship Meets Precision</p>
                <p className="text-lg text-violet-200 max-w-md leading-relaxed">
                  Streamline your tailoring business with our all-in-one management system designed for artisans who
                  value quality and efficiency.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-violet-300 rounded-full"></div>
                  <span className="text-violet-100">Effortless invoicing and payment tracking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-300 rounded-full"></div>
                  <span className="text-violet-100">Personalized customer service management</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-indigo-300 rounded-full"></div>
                  <span className="text-violet-100">Seamless tailor coordination system</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
          <div className="w-full max-w-md mx-auto">
            {/* Mobile Header */}
            <div className="text-center mb-8 lg:hidden">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">STAR TAILORS</h1>
              <p className="text-gray-600">Business Management System</p>
            </div>

            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
