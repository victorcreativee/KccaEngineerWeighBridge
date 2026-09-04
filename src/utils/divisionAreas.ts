export const divisionAreas: Record<string, string[]> = {
  Central: ["Kisenyi", "Old Kampala", "Kololo", "Kamwokya", "Buganda Rd", "Kampala Rd", "Jinja Rd", "Nasser", "Kagugube", "Nakasero", "Usafi", "Owino", "Bukesa", "Industrial Area"],
  Makindye: ["Namuwongo", "Kisugu", "Katwe", "Nsambya", "Salaama", "Lukuli", "Wabigalo", "Makindye", "Kibuye", "Luwafu", "Kabalagala", "Bukasa", "Buziga", "Gaba", "Muyenga", "Kibuli", "Munyonyo", "Kansanga"],
  Lubaga: ["Namungoona", "Nakulabye", "Mengo", "Busega", "Masanafu", "Kigobe", "Kabowa", "Kabuusu", "Bukuluji", "Lubaga", "Lungujja", "Najjanankumbi", "Nateete", "Lubya", "Mapeera", "Nabulagala", "Kasubi", "Mutundwe", "Kawaala", "Lugala", "Ndeeba"],
  Kawempe: ["Makerere", "Wandegeya", "Bwaise", "Ttula", "Mpererwe", "Kyebando", "Kirokole", "Mbogo", "Kazo Ward", "Nammere", "Kitala", "Mulago", "Kawempe", "Keti Falawo", "Kanyanya", "Kakungulu", "Kalerwe", "Sir. Apollo", "Kikaaya", "Komamboga"],
  Nakawa: ["Banda", "Nakawa", "Luzira", "Mutungo", "Naguru", "Kiswa", "Mulimira", "Ntinda", "Bugoloobi", "Butabika", "Kinawataka", "Mbuya", "Bbiina", "Bukoto", "Kyanja", "Kyambogo", "Nabisunsa", "Kisaasi"],
};

export function areasForDivision(division?: string) {
  const key = Object.keys(divisionAreas).find((name) => name.toLowerCase() === division?.trim().toLowerCase());
  return key ? divisionAreas[key] : [];
}
