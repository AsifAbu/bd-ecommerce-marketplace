/**
 * Bangladesh administrative areas for addresses: 8 divisions, 64 districts and
 * upazilas/thanas. Upazila lists are complete only for Dhaka district plus a few
 * districts used by seeds; other districts accept a typed upazila name.
 * Pre-release checklist: load the complete upazila/thana list.
 */
export const DISTRICTS_BY_DIVISION: Record<string, readonly string[]> = {
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Chattogram: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cox's Bazar",
    "Cumilla",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  Dhaka: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: ["Bogura", "Chapai Nawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};

export const DIVISIONS = Object.keys(DISTRICTS_BY_DIVISION);

export const UPAZILAS_BY_DISTRICT: Record<string, readonly string[]> = {
  // Dhaka district: 5 upazilas and the Dhaka Metropolitan Police thanas.
  Dhaka: [
    "Adabor",
    "Badda",
    "Banani",
    "Bangshal",
    "Bhashantek",
    "Bhatara",
    "Bimanbandar",
    "Cantonment",
    "Chawkbazar",
    "Dakshinkhan",
    "Darus Salam",
    "Demra",
    "Dhamrai",
    "Dhanmondi",
    "Dohar",
    "Gendaria",
    "Gulshan",
    "Hatirjheel",
    "Hazaribagh",
    "Jatrabari",
    "Kadamtali",
    "Kafrul",
    "Kalabagan",
    "Kamrangirchar",
    "Keraniganj",
    "Khilgaon",
    "Khilkhet",
    "Kotwali",
    "Lalbagh",
    "Mirpur Model",
    "Mohammadpur",
    "Motijheel",
    "Mugda",
    "Nawabganj",
    "New Market",
    "Pallabi",
    "Paltan",
    "Ramna",
    "Rampura",
    "Rupnagar",
    "Sabujbagh",
    "Savar",
    "Shah Ali",
    "Shahbagh",
    "Shahjahanpur",
    "Sher-e-Bangla Nagar",
    "Shyampur",
    "Sutrapur",
    "Tejgaon",
    "Tejgaon Industrial Area",
    "Turag",
    "Uttara East",
    "Uttara West",
    "Uttarkhan",
    "Wari",
  ],
  Gazipur: ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur", "Tongi"],
  Narayanganj: ["Araihazar", "Bandar", "Narayanganj Sadar", "Rupganj", "Siddhirganj", "Sonargaon"],
  Chattogram: ["Bakalia", "Chandgaon", "Double Mooring", "Halishahar", "Hathazari", "Khulshi", "Kotwali", "Pahartali", "Panchlaish", "Patiya", "Sitakunda"],
  Sylhet: ["Beanibazar", "Companiganj", "Golapganj", "Jalalabad", "Kotwali", "Shah Poran", "Sylhet Sadar"],
  Rajshahi: ["Boalia", "Godagari", "Motihar", "Paba", "Rajpara", "Shah Makhdum"],
  Khulna: ["Daulatpur", "Dumuria", "Khalishpur", "Khan Jahan Ali", "Khulna Sadar", "Sonadanga"],
};

export const districtsOf = (division: string): readonly string[] =>
  Object.hasOwn(DISTRICTS_BY_DIVISION, division) ? DISTRICTS_BY_DIVISION[division] : [];

/** Known upazilas/thanas of a district; empty when the list is not loaded yet (free text then). */
export const upazilasOf = (district: string): readonly string[] =>
  Object.hasOwn(UPAZILAS_BY_DISTRICT, district) ? UPAZILAS_BY_DISTRICT[district] : [];
