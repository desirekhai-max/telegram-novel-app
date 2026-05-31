import { Link } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

export default function AboutPage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar
        title="About Us · អំពីពួកយើង"
        titleLang="km"
        titleClassName="text-[16px]"
        showDivider
      />
      <main
        className="tg-list-wrap tg-about-scroll flex flex-1 flex-col gap-5 px-6 pb-32 pt-8"
        {...swipeHandlers}
      >
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
          <Link to="/contact-us" className="text-cyan-200/90 underline-offset-2 hover:underline">
            Contact Us
          </Link>
          ។
        </p>
      </main>
    </div>
  )
}
