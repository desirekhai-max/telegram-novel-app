import { Link } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

export default function TermsOfServicePage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar
        title="Terms of Service · លក្ខខណ្ឌប្រើប្រាស់"
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
          lang="km"
        >
          លក្ខខណ្ឌប្រើប្រាស់
        </p>

        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
          សូមអានលក្ខខណ្ឌប្រើប្រាស់ខាងក្រោមមុនពេលប្រើប្រាស់ 69KKH NOVEL។ ការបន្តប្រើប្រាស់វេទិកា
          មានន័យថាអ្នកយល់ព្រមតាមលក្ខខណ្ឌទាំងនេះ។
        </p>

        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
          <p className="mb-3 font-semibold text-white/85">សមាជិក VIP</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              សមាជិក VIP គឺជាសេវាសមាជិកឌីជីថល (Virtual Membership) មិនមែនជាផលិតផលរូបរាងផ្ទាល់ទេ។
            </li>
            <li>
              បន្ទាប់ពីការទិញជោគជ័យ អ្នកអាចអានមាតិកា VIP ក្នុងអំឡុងពេលសមាជិកភាពនៅមានសុពលភាព។
            </li>
            <li>
              បច្ចុប្បន្ន មិនមានការបន្តសមាជិកភាពដោយស្វ័យប្រវត្តិ (Auto-Renewal) ទេ។ អ្នកត្រូវទិញម្ដងទៀតដោយខ្លួនឯង។
            </li>
            <li>
              ការទូទាត់សម្រាប់សេវាឌីជីថល នឹងត្រូវអនុវត្តតាម{' '}
              <Link to="/refund-policy" className="text-amber-200/90 underline-offset-2 hover:underline">
                គោលការណ៍សងប្រាក់វិញ (Refund Policy)
              </Link>{' '}
              របស់វេទិកា។
            </li>
          </ul>
        </div>

        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
          <p className="mb-3 font-semibold text-white/85">ការប្រើប្រាស់វេទិកា</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>អ្នកប្រើប្រាស់ត្រូវមានអាយុយ៉ាងហោចណាស់ ១៨ ឆ្នាំ។</li>
            <li>
              ហាមប្រើប្រាស់វេទិកាក្នុងគោលបំណងខុសច្បាប់ ការបៀតបៀន ការរំខាន ឬអាកប្បកិរិយាមិនសមរម្យផ្សេងៗ។
            </li>
            <li>អ្នកប្រើប្រាស់មិនអាចចម្លង ចែកចាយ ឬប្រើប្រាស់មាតិកាដោយគ្មានការអនុញ្ញាតពីវេទិកា។</li>
            <li>អ្នកប្រើប្រាស់ត្រូវទទួលខុសត្រូវលើសុវត្ថិភាពគណនីរបស់ខ្លួន។</li>
            <li>វេទិកាមានសិទ្ធិផ្អាក ឬបិទគណនី ប្រសិនបើមានការរំលោភលើលក្ខខណ្ឌប្រើប្រាស់។</li>
          </ul>
        </div>

        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
          <p className="mb-3 font-semibold text-white/85">ការទូទាត់ និងសុវត្ថិភាព</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>ការទូទាត់ VIP ត្រូវបានដំណើរការតាម ABA PayWay។</li>
            <li>
              លេខកាតធនាគារ CVV និងកាលបរិច្ឆេទផុតកំណត់ ត្រូវបានបញ្ចូលតែលើទំព័រផ្លូវការរបស់ ABA PayWay
              ប៉ុណ្ណោះ។
            </li>
            <li>វេទិកាមិនរក្សាទុកព័ត៌មានកាតធនាគាររបស់អ្នកឡើយ។</li>
          </ul>
        </div>

        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="km">
          វេទិកាអាចធ្វើការកែប្រែលក្ខខណ្ឌប្រើប្រាស់បានគ្រប់ពេល ដោយមិនចាំបាច់ជូនដំណឹងជាមុន។
        </p>
      </main>
    </div>
  )
}
