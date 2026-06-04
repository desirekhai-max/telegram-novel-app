import { tryOpenTelegramMeLink } from '../lib/telegramWebApp.js'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import HomePageDom from '../components/HomePageDom.jsx'

const TELEGRAM_SUPPORT_URL = 'https://t.me/VIP_69kkh'

export default function RefundPolicyPage() {
  return (
    <HomePageDom toolbar={<BrandTabToolbar title="Refund Policy · គោលការណ៍សងប្រាក់វិញ" titleClassName="text-[16px]" />}>
      <ul className="tg-list tg-home-novel-list">
        <li className="tg-list__item flex flex-col gap-5">
      <p
        className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
        lang="km"
      >
        គោលការណ៍សងប្រាក់វិញ
      </p>

      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        សមាជិក VIP និងសេវាកម្មឌីជីថលទាំងអស់នៅលើ 69KKH NOVEL គឺជាសេវាកម្មនិម្មិត (Digital / Virtual
        Service)។
      </p>

      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        ដូច្នេះ បន្ទាប់ពីការទូទាត់បានជោគជ័យ ជាទូទៅ មិនអាចស្នើសុំសងប្រាក់វិញបានទេ។
      </p>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-3 font-semibold text-white/85">ករណីអាចស្នើសុំសងប្រាក់វិញបាន៖</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>ការទូទាត់បានជោគជ័យ ប៉ុន្តែមិនបានបើកសមាជិក VIP</li>
          <li>ការទូទាត់ត្រូវបានកាត់ប្រាក់ពីរដង</li>
          <li>បញ្ហាបច្ចេកទេសពីប្រព័ន្ធ</li>
        </ul>
      </div>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-2 font-semibold text-white/85">ដំណើរការពិនិត្យសំណើ៖</p>
        <p>រាល់សំណើនឹងត្រូវពិនិត្យតាមករណីជាក់ស្តែង។</p>
        <p className="mt-2">បើអនុម័ត ការសងប្រាក់នឹងធ្វើតាមវិធីទូទាត់ដើម។</p>
      </div>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-3 font-semibold text-white/85">ចំណាំសំខាន់៖</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>សេវាឌីជីថលមិនអាចសងប្រាក់វិញបានក្រោយផ្តល់ជោគជ័យ</li>
          <li>អ្នកប្រើប្រាស់ត្រូវពិនិត្យមុនទូទាត់</li>
          <li>ការប្រើប្រាស់ខុសច្បាប់អាចបិទគណនីបាន</li>
        </ul>
      </div>

      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-2 font-semibold text-white/85">ទាក់ទងក្រុមការងារ៖</p>
        <p>
          Telegram:{' '}
          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-200/90 no-underline hover:text-cyan-100"
            onClick={(e) => {
              if (tryOpenTelegramMeLink(TELEGRAM_SUPPORT_URL)) e.preventDefault()
            }}
          >
            @VIP_69kkh
          </a>
        </p>
      </div>
        </li>
      </ul>
    </HomePageDom>
  )
}
