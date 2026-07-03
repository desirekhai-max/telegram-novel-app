import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import HomePageDom from '../components/HomePageDom.jsx'
import { useMainTabShell } from '../hooks/useMainTabShell.js'

export default function PrivacyPolicyPage() {
  const usesSharedToolbar = useMainTabShell()
  const toolbar = usesSharedToolbar ? null : (
    <BrandTabToolbar title="Privacy Policy · គោលការណ៍ឯកជនភាព" titleClassName="text-[16px]" />
  )

  return (
    <HomePageDom toolbar={toolbar}>
      <ul className="tg-list tg-home-novel-list">
        <li className="tg-list__item flex flex-col gap-5">
          <p
            className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
            lang="km"
          >
            យើងគោរពភាពឯកជនរបស់អ្នក។
          </p>

          <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            69KKH NOVEL គោរព និងការពារឯកជនភាពរបស់អ្នកប្រើប្រាស់ទាំងអស់។ យើងខិតខំរក្សាសុវត្ថិភាពព័ត៌មាន
            និងផ្តល់បទពិសោធន៍ប្រើប្រាស់ដែលមានភាពជឿជាក់ និងសុវត្ថិភាព។
          </p>

          <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            <p className="mb-3 font-semibold text-white/85">ព័ត៌មានដែលអាចត្រូវបានប្រមូល</p>
            <p className="mb-3">
              វេទិកាអាចប្រមូលព័ត៌មានមូលដ្ឋានមួយចំនួន ដើម្បីផ្តល់សេវាកម្ម និងគ្រប់គ្រងគណនីរបស់អ្នក ដូចជា៖
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Telegram Username</li>
              <li>Telegram User ID</li>
              <li>ព័ត៌មានសមាជិកភាព VIP</li>
              <li>លេខប្រតិបត្តិការ (Transaction ID)</li>
              <li>ព័ត៌មានកញ្ចប់សមាជិក និងរយៈពេលសមាជិកភាព</li>
            </ul>
            <p className="mt-3">
              ព័ត៌មានទាំងនេះត្រូវបានប្រើសម្រាប់ការផ្តល់សេវាកម្ម ការគាំទ្រអតិថិជន និងការកែលម្អប្រព័ន្ធតែប៉ុណ្ណោះ។
            </p>
          </div>

          <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            <p className="mb-3 font-semibold text-white/85">សុវត្ថិភាពការទូទាត់</p>
            <p>
              ការទូទាត់ VIP ត្រូវបានដំណើរការតាមរយៈ ABA KHQR និង ABA PayWay
            </p>
            <p className="mt-3">
              69KKH Novel មិនប្រមូល មិនរក្សាទុក និងមិនចែករំលែកព័ត៌មានគណនីធនាគារ ឬព័ត៌មានការទូទាត់របស់អ្នកឡើយ
            </p>
            <p className="mt-3">
              រាល់ប្រតិបត្តិការទូទាត់ត្រូវបានដំណើរការដោយប្រព័ន្ធសុវត្ថិភាពរបស់ ABA Bank
            </p>
          </div>

          <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            <p className="mb-2 font-semibold text-white/85">ការការពារព័ត៌មាន</p>
            <p>
              យើងខិតខំអនុវត្តវិធានការសុវត្ថិភាពសមស្រប ដើម្បីការពារព័ត៌មានអ្នកប្រើប្រាស់ពីការចូលប្រើដោយគ្មានការអនុញ្ញាត
              ការបាត់បង់ ឬការប្រើប្រាស់មិនត្រឹមត្រូវ។
            </p>
          </div>

          <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            <p className="mb-2 font-semibold text-white/85">ការចែករំលែកព័ត៌មាន</p>
            <p>
              យើងមិនលក់ ឬចែករំលែកព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នកទៅភាគីទីបីដោយគ្មានការអនុញ្ញាតឡើយ លើកលែងតែករណីដែលច្បាប់តម្រូវ។
            </p>
          </div>

          <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
            ដោយប្រើប្រាស់វេទិកានេះ អ្នកយល់ព្រមតាមគោលការណ៍ឯកជនភាពនេះ។
          </p>
        </li>
      </ul>
    </HomePageDom>
  )
}
