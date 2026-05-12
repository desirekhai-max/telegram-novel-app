import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { tryOpenTelegramMeLink } from '../lib/telegramWebApp.js'

export default function ContactUsPage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="Contact Us" titleLang="en" showDivider />
      <main
        className="tg-list-wrap tg-about-scroll flex flex-1 flex-col gap-5 px-6 pb-32 pt-8"
        {...swipeHandlers}
      >
        <p
          className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
          lang="en"
        >
          Contact Us
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          If you have any questions or need support, please contact us:
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Telegram:{' '}
          <a
            href="https://t.me/VIP_69kkh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--tg-blue)] underline-offset-2 transition-colors hover:text-[var(--tg-blue-hover)] hover:underline"
            onClick={(e) => {
              if (tryOpenTelegramMeLink('https://t.me/VIP_69kkh')) e.preventDefault()
            }}
          >
            @VIP_69kkh
          </a>
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Email:{' '}
          <a
            href="mailto:ACB123@Gmail.com"
            className="text-[var(--tg-blue)] underline-offset-2 transition-colors hover:text-[var(--tg-blue-hover)] hover:underline"
          >
            ACB123@Gmail.com
          </a>
        </p>
        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          <p>Business Hours:</p>
          <p>Monday - Friday</p>
          <p>9:00 AM - 6:00 PM</p>
        </div>
      </main>
    </div>
  )
}
