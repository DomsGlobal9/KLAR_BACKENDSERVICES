import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPopularArea extends Document {
  cityKey: string;
  name: string;
  description: string;
  tag?: "POPULAR" | "TRENDING";
}

const popularAreaSchema = new Schema<IPopularArea>(
  {
    cityKey: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      enum: ["POPULAR", "TRENDING", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PopularAreaModel: Model<IPopularArea> =
  mongoose.models.PopularArea ||
  mongoose.model<IPopularArea>("PopularArea", popularAreaSchema);

/**
 * Seeds default popular sub-areas for well-known Indian cities if the collection is empty.
 */
export async function seedPopularAreas() {
  try {
    const existingCount = await PopularAreaModel.countDocuments();
    if (existingCount > 0) {
      console.log(`[Sync] Skip Popular Areas Seeding: DB already has ${existingCount} areas.`);
      return;
    }

    console.log("[Sync] Seeding default popular areas into MongoDB...");
    const defaults = [
      // Hyderabad
      { cityKey: "hyderabad", name: "Gachibowli", description: "IT hub with premium stays", tag: "POPULAR" },
      { cityKey: "hyderabad", name: "Hitech City", description: "Digital Innovation Hub", tag: "TRENDING" },
      { cityKey: "hyderabad", name: "Banjara Hills", description: "Upscale stays & dining" },
      { cityKey: "hyderabad", name: "Jubilee Hills", description: "Luxury hotels & resorts" },
      { cityKey: "hyderabad", name: "Secunderabad", description: "Twin city business stays" },
      
      // Mumbai
      { cityKey: "mumbai", name: "Bandra", description: "Trendy stays near sea link", tag: "POPULAR" },
      { cityKey: "mumbai", name: "Colaba", description: "Heritage & business hotels", tag: "TRENDING" },
      { cityKey: "mumbai", name: "Andheri", description: "Near airport, business stays" },
      { cityKey: "mumbai", name: "Lower Parel", description: "Corporate & luxury hotels" },
      { cityKey: "mumbai", name: "Juhu", description: "Beach-facing premium hotels" },

      // Delhi
      { cityKey: "delhi", name: "Connaught Place", description: "Central Delhi stays", tag: "POPULAR" },
      { cityKey: "delhi", name: "Aerocity", description: "Close to IGI Airport", tag: "TRENDING" },
      { cityKey: "delhi", name: "Karol Bagh", description: "Budget & mid-range stays" },
      { cityKey: "delhi", name: "Saket", description: "South Delhi premium hotels" },
      { cityKey: "delhi", name: "Noida", description: "NCR business & tech stays" },

      // New (matches "new delhi")
      { cityKey: "new", name: "Connaught Place", description: "Central Delhi stays", tag: "POPULAR" },
      { cityKey: "new", name: "Aerocity", description: "Close to IGI Airport", tag: "TRENDING" },
      { cityKey: "new", name: "Karol Bagh", description: "Budget & mid-range stays" },

      // Bangalore
      { cityKey: "bangalore", name: "Whitefield", description: "IT corridor business stays", tag: "POPULAR" },
      { cityKey: "bangalore", name: "Indiranagar", description: "Trendy locality with boutique hotels", tag: "TRENDING" },
      { cityKey: "bangalore", name: "MG Road", description: "Central Bangalore hotels" },
      { cityKey: "bangalore", name: "Electronic City", description: "Tech park proximity stays" },
      { cityKey: "bangalore", name: "Koramangala", description: "Startup hub & cafes" },

      // Bengaluru
      { cityKey: "bengaluru", name: "Whitefield", description: "IT corridor business stays", tag: "POPULAR" },
      { cityKey: "bengaluru", name: "Indiranagar", description: "Trendy locality with boutique hotels", tag: "TRENDING" },
      { cityKey: "bengaluru", name: "MG Road", description: "Central Bangalore hotels" },
      { cityKey: "bengaluru", name: "Electronic City", description: "Tech park proximity stays" },
      { cityKey: "bengaluru", name: "Koramangala", description: "Startup hub & cafes" },

      // Chennai
      { cityKey: "chennai", name: "T Nagar", description: "Shopping & business hub", tag: "POPULAR" },
      { cityKey: "chennai", name: "Adyar", description: "Upscale residential & hotels", tag: "TRENDING" },
      { cityKey: "chennai", name: "Anna Nagar", description: "Mid-range family stays" },
      { cityKey: "chennai", name: "OMR", description: "IT corridor hotels" },
      { cityKey: "chennai", name: "Velachery", description: "South Chennai business stays" },

      // Kolkata
      { cityKey: "kolkata", name: "Park Street", description: "Heritage & luxury stays", tag: "POPULAR" },
      { cityKey: "kolkata", name: "Salt Lake", description: "IT sector business hotels", tag: "TRENDING" },
      { cityKey: "kolkata", name: "New Town", description: "Modern planned area hotels" },
      { cityKey: "kolkata", name: "Howrah", description: "Station-side budget stays" },

      // Goa
      { cityKey: "goa", name: "Calangute", description: "North Goa beach stays", tag: "POPULAR" },
      { cityKey: "goa", name: "Baga", description: "Beach party hub hotels", tag: "TRENDING" },
      { cityKey: "goa", name: "Panjim", description: "Capital city heritage stays" },
      { cityKey: "goa", name: "Candolim", description: "Quiet north Goa resorts" },
      { cityKey: "goa", name: "Anjuna", description: "Bohemian beach boutique stays" },

      // Jaipur
      { cityKey: "jaipur", name: "MI Road", description: "Central Jaipur stays", tag: "POPULAR" },
      { cityKey: "jaipur", name: "C Scheme", description: "Upscale residential hotels", tag: "TRENDING" },
      { cityKey: "jaipur", name: "Amer", description: "Fort-view heritage hotels" },
      { cityKey: "jaipur", name: "Vaishali Nagar", description: "West Jaipur budget stays" },

      // Pune
      { cityKey: "pune", name: "Koregaon Park", description: "Upscale stays & nightlife", tag: "POPULAR" },
      { cityKey: "pune", name: "Hinjewadi", description: "IT hub business hotels", tag: "TRENDING" },
      { cityKey: "pune", name: "Camp", description: "Central Pune colonial stays" },
      { cityKey: "pune", name: "Kharadi", description: "East Pune IT corridor" },
      { cityKey: "pune", name: "Baner", description: "West Pune residential hotels" },

      // Ahmedabad
      { cityKey: "ahmedabad", name: "SG Highway", description: "Business corridor stays", tag: "POPULAR" },
      { cityKey: "ahmedabad", name: "Navrangpura", description: "Central city hotels", tag: "TRENDING" },
      { cityKey: "ahmedabad", name: "Prahlad Nagar", description: "Upscale western Ahmedabad" },

      // Surat
      { cityKey: "surat", name: "Athwa", description: "Central Surat commercial stays", tag: "POPULAR" },
      { cityKey: "surat", name: "Vesu", description: "South Surat upscale hotels", tag: "TRENDING" },

      // Kochi
      { cityKey: "kochi", name: "Marine Drive", description: "Waterfront hotels", tag: "POPULAR" },
      { cityKey: "kochi", name: "Fort Kochi", description: "Heritage & boutique stays", tag: "TRENDING" },
      { cityKey: "kochi", name: "Edapally", description: "Near airport business stays" },

      // Cochin
      { cityKey: "cochin", name: "Marine Drive", description: "Waterfront hotels", tag: "POPULAR" },
      { cityKey: "cochin", name: "Fort Kochi", description: "Heritage & boutique stays", tag: "TRENDING" },

      // Agra
      { cityKey: "agra", name: "Taj Ganj", description: "Closest to Taj Mahal", tag: "POPULAR" },
      { cityKey: "agra", name: "Fatehabad Road", description: "Heritage hotel strip", tag: "TRENDING" },
      { cityKey: "agra", name: "Sadar Bazaar", description: "Central Agra budget stays" },

      // Varanasi
      { cityKey: "varanasi", name: "Assi Ghat", description: "Riverside spiritual stays", tag: "POPULAR" },
      { cityKey: "varanasi", name: "Dashashwamedh", description: "Near main ghat hotels", tag: "TRENDING" },
      { cityKey: "varanasi", name: "Cantonment", description: "Near station business stays" },

      // Udaipur
      { cityKey: "udaipur", name: "Lake Pichola", description: "Lake-view luxury hotels", tag: "POPULAR" },
      { cityKey: "udaipur", name: "Fateh Sagar", description: "Lakeside boutique stays", tag: "TRENDING" },
      { cityKey: "udaipur", name: "Hiran Magri", description: "Budget & mid-range areas" },

      // Lonavala
      { cityKey: "lonavala", name: "Khandala", description: "Scenic valley views & hiking", tag: "POPULAR" },
      { cityKey: "lonavala", name: "Gold Valley", description: "Premium villas & private stays", tag: "TRENDING" },
      { cityKey: "lonavala", name: "Tungarli", description: "Peaceful hilltop resorts" },
      { cityKey: "lonavala", name: "Valvan", description: "Close to dam and highway stays" },

      // Lonavla
      { cityKey: "lonavla", name: "Khandala", description: "Scenic valley views & hiking", tag: "POPULAR" },
      { cityKey: "lonavla", name: "Gold Valley", description: "Premium villas & private stays", tag: "TRENDING" },
      { cityKey: "lonavla", name: "Tungarli", description: "Peaceful hilltop resorts" },
      { cityKey: "lonavla", name: "Valvan", description: "Close to dam and highway stays" },
    ];

    await PopularAreaModel.insertMany(defaults);
    console.log(`[Sync] Successfully seeded ${defaults.length} popular sub-areas.`);
  } catch (err: any) {
    console.error("[Sync] Error seeding popular areas:", err.message);
  }
}
