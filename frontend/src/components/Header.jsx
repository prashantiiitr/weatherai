import ThemeToggle from './ThemeToggle' 

export default function Header(){
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center font-bold">W</div>
        <div>
          <h1 className="text-2xl font-semibold">WeatherDeck</h1>
          <p className="text-sm text-gray-500">Track current & 5-day forecast</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle /> {}
      </div>
    </header>
  )
}
