import BrandTabToolbar from '../components/BrandTabToolbar.jsx'

export default function VipPage() {
  return (
    <div className="tg-app">
      <BrandTabToolbar title="សមាជិក VIP" />
      <main className="tg-list-wrap flex flex-1 items-center justify-center px-6">
        <p className="text-center text-sm text-white/40" lang="km">
          មុខងារ VIP កំពុងរៀបចំ។
        </p>
      </main>
    </div>
  )
}
