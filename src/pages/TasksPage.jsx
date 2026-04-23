import BrandTabToolbar from '../components/BrandTabToolbar.jsx'

export default function TasksPage() {
  return (
    <div className="tg-app">
      <BrandTabToolbar title="ភារកិច្ច" />
      <main className="tg-list-wrap flex flex-1 items-center justify-center px-6">
        <p className="text-center text-sm text-white/40" lang="km">
          មិនទាន់មានភារកិច្ចទេ។
        </p>
      </main>
    </div>
  )
}
