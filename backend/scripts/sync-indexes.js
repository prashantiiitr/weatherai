import 'dotenv/config'
import { connectDB } from '../src/lib/db.js'
import City from '../src/models/City.js'
import WeatherCache from '../src/models/WeatherCache.js'

await connectDB(process.env.MONGODB_URI)
await City.syncIndexes()
await WeatherCache.syncIndexes()
console.log('Indexes synced for City and WeatherCache.')
process.exit(0)
