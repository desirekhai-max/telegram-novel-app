import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

export default function AboutPage() {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="About Us" titleLang="en" showDivider />
      <main
        className="tg-list-wrap tg-about-scroll flex flex-1 flex-col gap-5 px-6 pb-32 pt-8"
        {...swipeHandlers}
      >
        <p
          className="mx-auto max-w-md text-center text-[1.05rem] font-medium leading-relaxed text-white/90"
          lang="en"
        >
          Welcome to 69KKH Meta.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          69KKH is a Telegram Mini App focused on providing users with a modern digital fiction
          reading experience.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Our platform offers a wide range of stories and novels designed for entertainment and
          personal reading enjoyment. We are committed to creating a smooth, secure, and
          user-friendly reading environment for our community.
        </p>
        <div className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          <p className="mb-3">Key features of our platform include:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Easy online reading experience</li>
            <li>Personalized content recommendations</li>
            <li>Secure user experience</li>
            <li>VIP membership services</li>
            <li>Mobile-friendly access through Telegram</li>
          </ul>
        </div>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Our goal is to build a high-quality digital reading platform that allows users to enjoy
          fiction content conveniently and safely.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          If you have any questions or feedback, please feel free to contact us anytime.
        </p>
        <p className="mx-auto max-w-md text-[0.95rem] leading-[1.75] text-white/70" lang="en">
          Email:
        </p>
      </main>
    </div>
  )
}
