import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

export default function PrivacyPolicyPage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="Privacy Policy" titleLang="en" titleClassName="text-[15px]" showDivider />
      <main
        className="tg-list-wrap tg-about-scroll flex flex-1 flex-col gap-5 px-6 pb-32 pt-8"
        {...swipeHandlers}
      >
        <p
          className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
          lang="en"
        >
          We respect your privacy.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Our platform may collect basic user information such as Telegram username, user ID, and
          payment-related information for service operation purposes.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          We do not sell or share personal information with unauthorized third parties.
        </p>
        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          <p className="mb-3">Your information is used only for:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account management</li>
            <li>Payment processing</li>
            <li>Service improvement</li>
            <li>Customer support</li>
          </ul>
        </div>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          We take reasonable steps to protect user data and maintain platform security.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          By using the platform, you agree to this Privacy Policy.
        </p>
      </main>
    </div>
  )
}
