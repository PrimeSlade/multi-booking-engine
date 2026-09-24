import { db } from '@/prisma/db';

const airlines = [
  { id: 'aa', name: 'American Airlines' },
  { id: 'dl', name: 'Delta Air Lines' },
  { id: 'ua', name: 'United Airlines' },
  { id: 'sw', name: 'Southwest Airlines' },
  { id: 'b6', name: 'JetBlue Airways' },
  { id: 'as', name: 'Alaska Airlines' },
  { id: 'f9', name: 'Frontier Airlines' },
  { id: 'nk', name: 'Spirit Airlines' },
  { id: 'g4', name: 'Allegiant Air' },
  { id: 'sy', name: 'Sun Country Airlines' },
];

const airports = [
  'JFK',
  'LAX',
  'ORD',
  'DFW',
  'DEN',
  'SFO',
  'SEA',
  'LAS',
  'MCO',
  'MIA',
  'PHX',
  'IAH',
  'BOS',
  'MSP',
  'DTW',
  'PHL',
  'LGA',
  'BWI',
  'SAN',
  'TPA',
  'PDX',
  'HNL',
  'AUS',
  'SLC',
  'SJC',
  'SMF',
  'OAK',
  'SNA',
  'ONT',
  'BUR',
];

const hotelCities = [
  {
    city: 'New York',
    hotels: [
      'Grand Hyatt',
      'Marriott Marquis',
      'Hilton Midtown',
      'Sheraton Times Square',
      'Westin Grand Central',
    ],
  },
  {
    city: 'Los Angeles',
    hotels: [
      'The Beverly Hilton',
      'JW Marriott LA Live',
      'Hotel Figueroa',
      'The Westin Bonaventure',
      'InterContinental Downtown',
    ],
  },
  {
    city: 'Chicago',
    hotels: [
      'Palmer House Hilton',
      'Chicago Marriott Downtown',
      'Hyatt Regency Chicago',
      'Swissotel Chicago',
      'Kimpton Gray Hotel',
    ],
  },
  {
    city: 'Miami',
    hotels: [
      'Fontainebleau Miami Beach',
      'Eden Roc Miami Beach',
      'The Setai Miami Beach',
      'Faena Hotel',
      '1 Hotel South Beach',
    ],
  },
  {
    city: 'Las Vegas',
    hotels: [
      'Bellagio',
      'Caesars Palace',
      'The Venetian',
      'Wynn Las Vegas',
      'Aria Resort Casino',
    ],
  },
  {
    city: 'San Francisco',
    hotels: [
      'Fairmont San Francisco',
      'Hotel Nikko',
      'Marriott Marquis SF',
      'Hyatt Regency SF',
      'InterContinental SF',
    ],
  },
  {
    city: 'Seattle',
    hotels: [
      'Four Seasons Seattle',
      'The Edgewater',
      'Hyatt at Olive 8',
      'Marriott Waterfront',
      'Grand Hyatt Seattle',
    ],
  },
  {
    city: 'Boston',
    hotels: [
      'Boston Marriott Copley',
      'Hyatt Regency Boston',
      'Hilton Boston Downtown',
      'Four Seasons Boston',
      'InterContinental Boston',
    ],
  },
  {
    city: 'Denver',
    hotels: [
      'The Crawford Hotel',
      'Grand Hyatt Denver',
      'Marriott City Center',
      'Hyatt Regency Denver',
      'Sheraton Denver Downtown',
    ],
  },
  {
    city: 'Austin',
    hotels: [
      'Fairmont Austin',
      'JW Marriott Austin',
      'Four Seasons Austin',
      'Hyatt Regency Austin',
      'Hilton Austin',
    ],
  },
];

const roomTypes = [
  'Standard',
  'Deluxe',
  'Suite',
  'Executive Suite',
  'Presidential Suite',
];

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🌱 Starting database seed...');
  await db.connect();

  console.log('📦 Creating airlines...');
  for (const airline of airlines) {
    try {
      await db.orm.public.Airline.create(airline);
    } catch (e) {
      // Ignore duplicate errors
    }
  }

  console.log('✈️ Creating flights...');
  const now = new Date();
  const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 50; i++) {
    const airline = randomElement(airlines);
    const origin = randomElement(airports);
    let destination = randomElement(airports);
    while (destination === origin) {
      destination = randomElement(airports);
    }

    const departureTime = randomDate(now, threeMonthsLater);
    const flightNumber = `${airline.id.toUpperCase()}${randomInt(100, 9999)}`;

    await db.orm.public.Flight.create({
      id: `flight-${i + 1}`,
      airlineId: airline.id,
      flightNumber,
      origin,
      destination,
      departureTime: departureTime.toISOString(),
      price: String(randomInt(150, 1200)),
      seatsLeft: randomInt(5, 200),
    });
  }

  console.log('🏨 Creating hotels and rooms...');
  let hotelCount = 0;
  for (const { city, hotels } of hotelCities) {
    for (const hotelName of hotels) {
      if (hotelCount >= 50) break;

      const hotelId = `hotel-${hotelCount + 1}`;
      try {
        await db.orm.public.Hotel.create({
          id: hotelId,
          name: hotelName,
          city,
        });
      } catch (e) {
        // Ignore duplicate errors
      }

      for (const roomType of roomTypes) {
        try {
          await db.orm.public.Room.create({
            id: `${hotelId}-${roomType.toLowerCase().replace(' ', '-')}`,
            hotelId,
            roomType,
            price: String(randomInt(100, 800)),
            roomsLeft: 10,
          });
        } catch (e) {
          // Ignore duplicate errors
        }
      }

      hotelCount++;
    }
    if (hotelCount >= 50) break;
  }

  console.log('🚫 Seeding fraud blacklist...');
  const blacklistedUserIds = ['ok@email.com', 'slade@email.com'];
  for (const userId of blacklistedUserIds) {
    try {
      await db.orm.public.FraudBlacklist.create({ userId });
    } catch (e) {
      // Ignore duplicate errors
    }
  }

  console.log('✅ Seed completed successfully!');
  console.log(`   Airlines: ${airlines.length}`);
  console.log(`   Flights: 50`);
  console.log(`   Hotels: 50`);
  console.log(`   Rooms: ${50 * roomTypes.length}`);
  console.log(`   Fraud blacklist: ${blacklistedUserIds.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.close();
  });
