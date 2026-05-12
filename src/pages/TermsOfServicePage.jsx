import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

export default function TermsOfServicePage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="Terms of Service" titleLang="en" titleClassName="text-[15px]" showDivider />
      <main
        className="tg-list-wrap tg-about-scroll flex flex-1 flex-col gap-5 px-6 pb-32 pt-8"
        {...swipeHandlers}
      >
        <p
          className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
          lang="en"
        >
          Welcome to our platform.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          By using our Telegram Mini App and services, you agree to the following terms:
        </p>
        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Users must be at least 18 years old to access the platform.</li>
            <li>The platform provides digital fiction reading services for entertainment purposes only.</li>
            <li>Users are responsible for maintaining the security of their accounts.</li>
            <li>
              Users may not copy, redistribute, or misuse any content from the platform without
              permission.
            </li>
            <li>We reserve the right to suspend or terminate accounts that violate our policies.</li>
            <li>All payments for digital services are final unless otherwise stated.</li>
            <li>We may update these terms at any time without prior notice.</li>
          </ol>
        </div>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          If you do not agree with these terms, please stop using the platform.
        </p>
      </main>
    </div>
  )
}
