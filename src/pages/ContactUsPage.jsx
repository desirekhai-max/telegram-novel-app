import {
  buildSupportEmailOpenHref,
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_EMAIL_SUBJECT,
  openMailtoEmail,
  tryOpenTelegramMeLink,
} from '../lib/telegramWebApp.js'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import HomePageViewport from '../components/HomePageViewport.jsx'

const TELEGRAM_SUPPORT_URL = 'https://t.me/VIP_69kkh'
const SUPPORT_EMAIL = DEFAULT_SUPPORT_EMAIL

export default function ContactUsPage() {
  const supportEmailOpenHref = buildSupportEmailOpenHref(
    SUPPORT_EMAIL,
    DEFAULT_SUPPORT_EMAIL_SUBJECT,
  )

  return (
    <HomePageViewport toolbar={<BrandTabToolbar title="Contact Us · ទាក់ទងមកយើង" titleClassName="text-[16px]" showDivider />}>
      <ul className="tg-list tg-home-novel-list">
        <li className="tg-list__item flex flex-col gap-5">
      <p
        className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
        lang="km"
      >
        ទាក់ទងមកយើងខ្ញុំ
      </p>

      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        ប្រសិនបើអ្នកមានសំណួរ បញ្ហាបច្ចេកទេស ឬត្រូវការជំនួយទាក់ទងនឹងការប្រើប្រាស់ 69KKH NOVEL
        អ្នកអាចទាក់ទងក្រុមការងាររបស់យើងបានគ្រប់ពេល។
      </p>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-3 font-semibold text-white/85">សេវាកម្មគាំទ្រអតិថិជន</p>
        <ul className="list-none space-y-2 pl-0">
          <li>
            Telegram Support:{' '}
            <a
              href={TELEGRAM_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-200/90 underline-offset-2 hover:underline"
              onClick={(e) => {
                if (tryOpenTelegramMeLink(TELEGRAM_SUPPORT_URL)) e.preventDefault()
              }}
            >
              @VIP_69kkh
            </a>
          </li>
          <li>
            Email:{' '}
            <a
              href={supportEmailOpenHref}
              className="text-cyan-200/90 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.preventDefault()
                void openMailtoEmail(SUPPORT_EMAIL, { subject: DEFAULT_SUPPORT_EMAIL_SUBJECT })
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                void openMailtoEmail(SUPPORT_EMAIL, { subject: DEFAULT_SUPPORT_EMAIL_SUBJECT })
              }}
            >
              {SUPPORT_EMAIL}
            </a>
          </li>
        </ul>
      </div>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-2 font-semibold text-white/85">ម៉ោងធ្វើការ</p>
        <p>ថ្ងៃចន្ទ ដល់ ថ្ងៃសុក្រ</p>
        <p className="tabular-nums">9:00 AM – 6:00 PM</p>
      </div>

      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        យើងខិតខំឆ្លើយតប និងដោះស្រាយបញ្ហារបស់អ្នកឱ្យបានលឿនតាមដែលអាចធ្វើទៅបាន។
      </p>

      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        សូមអរគុណចំពោះការគាំទ្រ និងការប្រើប្រាស់ 69KKH NOVEL។
      </p>
        </li>
      </ul>
    </HomePageViewport>
  )
}
