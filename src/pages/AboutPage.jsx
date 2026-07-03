import { Link } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import HomePageDom from '../components/HomePageDom.jsx'
import { useMainTabShell } from '../hooks/useMainTabShell.js'

export default function AboutPage() {
  const usesSharedToolbar = useMainTabShell()
  const toolbar = usesSharedToolbar ? null : (
    <BrandTabToolbar title="About Us · អំពីពួកយើង" titleClassName="text-[16px]" />
  )

  return (
    <HomePageDom toolbar={toolbar}>
      <ul className="tg-list tg-home-novel-list">
        <li className="tg-list__item flex flex-col gap-5">
      <p
        className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
        lang="en"
      >
        Welcome to 69KKH NOVEL.
      </p>
      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        69KKH NOVEL គឺជា Telegram Mini App សម្រាប់អានរឿងឌីជីថល ដែលផ្តល់បទពិសោធន៍អានរឿងងាយស្រួល ទំនើប
        និងសុវត្ថិភាពសម្រាប់អ្នកប្រើប្រាស់។
      </p>
      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        វេទិការបស់យើងផ្តោតលើការផ្តល់មាតិកាអានកម្សាន្ត បទពិសោធន៍ប្រើប្រាស់ល្អ និងការចូលប្រើបានយ៉ាងងាយស្រួលតាមរយៈ
        Telegram។
      </p>
      <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        <p className="mb-3">មុខងារសំខាន់ៗរួមមាន៖</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>ការអានរឿងតាមអ៊ីនធឺណិត</li>
          <li>សមាជិកភាព VIP</li>
          <li>ការប្រើប្រាស់ងាយស្រួលលើទូរស័ព្ទ</li>
          <li>ប្រព័ន្ធគណនី និងការជូនដំណឹង</li>
          <li>បរិយាកាសប្រើប្រាស់មានសុវត្ថិភាព</li>
        </ul>
      </div>
      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        យើងខិតខំបង្កើតវេទិកាអានរឿងឌីជីថលដែលមានគុណភាព និងផ្តល់បទពិសោធន៍ល្អសម្រាប់អ្នកប្រើប្រាស់ទាំងអស់។
      </p>
      <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
        ប្រសិនបើអ្នកមានសំណួរ ឬត្រូវការជំនួយ សូមទាក់ទងក្រុមការងាររបស់យើងតាមរយៈ{' '}
        <Link to="/contact-us" className="text-cyan-200/90 no-underline hover:text-cyan-100">
          Contact Us
        </Link>
        ។
      </p>
        </li>
      </ul>
    </HomePageDom>
  )
}
