require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const TeamSchema = new mongoose.Schema({
  id: { type: String },
  teamId: { type: String, required: true, unique: true },
  teamName: { type: String, required: true },
  members: { type: String },
  loginCode: { type: String },
  startTime: { type: Number, default: null },
  endTime: { type: Number, default: null },
  puzzlesSolved: { type: Number, default: 0 },
  puzzleAnswers: { type: Object, default: {} },
  puzzleAttempts: { type: Object, default: {} },
  loginAttempts: { type: Number, default: 0 },
  loggedIn: { type: Boolean, default: false },
  isQualified: { type: Boolean, default: false }
});

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

const teamsData = [
  { name: "Final Exit", members: "Siddhi Shankar Divate, Shreya Naik, Vikas Koppad, Kavya Nagendra Karoshi" },
  { name: "The Golden Wolves", members: "Rashmi Gaonkar, AMOGH S PATIL, Yukta Bhat, Naveen B Gurikar" },
  { name: "Ctrl Alt Delete", members: "Harshil Jad, Agrim Kedia, Korounganba Nongmaithem, Vidhish R Saliyan" },
  { name: "Alt F4", members: "Sumanyu Kulkarni, Prashant Magennavar, Kishan Ingalalli" },
  { name: "Ankita S joshi", members: "Ankita s joshi, Shrusti Tegginamath, Sanjana S Korlahalli, Arpita s joshi" },
  { name: "The Resonators", members: "Akshay Bedre, Laxman Hanamant Jangali" },
  { name: "Techno Neurons", members: "Atharva Vaidya, Sanath Suresh Deshpande, Manu Murnal, Tejas Hugar" },
  { name: "THE MACK", members: "MOHAMMED MATEEN ASUNDI, Mohammed Kalimulla Momin, Amaanulla" },
  { name: "Escape Crackers", members: "Abhinav Srivastava, Shrivardhan s k" },
  { name: "The Hidden Variables", members: "Karan A Sharma" },
  { name: "Mind Matrix", members: "Vijayalaxmi Patil, Kavita Bangi, Rajarajeshwari Sadalapur, Rakshita Madrimath" },
  { name: "Tech warriors", members: "Venkatesh Pote, Vivek. Kamannavar" },
  { name: "wRpjVd", members: "Prajwal Kumar" },
  { name: "Secret seekers", members: "Vedang, Sneha Patil" },
  { name: "Code & Chaos", members: "Shreya V Hadagali, Soubhagya Suresh Madiwalar, Pooja Rathi, Shraddha S S" },
  { name: "BEING HUMANS", members: "Mohmed taha Khan, Nooren Gokak, Adbeeya hudi, Anha Mujawar" },
  { name: "Matric Decoders", members: "narayan, Santosh Kashinath Kammar, Prajwal Lalsangi, RAVITEJA GARA" },
  { name: "QuadCore", members: "Prasad Morab, Shashank Joshi, Siddharth Prabhu, SHREENIKETH JOSHI" },
  { name: "CTRL SHIFT ESC", members: "Ayush Yaligar, Amogh Pai" },
  { name: "Mystic", members: "Praneel Patil, Om Kulkarni" },
  { name: "Mava", members: "Mallikarjun Paroji, Ayush Bhandari" },
  { name: "BUG HUNTERS", members: "Naveen S Pawar, Sanket khot, Nandeesh Nargund" },
  { name: "Hack-Slayers", members: "Saniya Rahmat Soudagar, Manali Naik, Satish Kamati, Samnaan" },
  { name: "Escape Architects", members: "Priyanka mishennavar, Sahana Bhusanuramath, Sinchana Belagali, Keerthana Susangi" },
  { name: "Tech survivers", members: "Nandini SK, Poorva M Harti, PRATIKSHA HIREMATH, Shravani Sonnad" },
  { name: "Debugg n chill", members: "Saniya gargi, Uma, Sampada S Angadi, Bhumika Bandodkar" },
  { name: "Escape.exe", members: "Spoorthi C, Sanika Thorushe, Janhavi Budihale, Sakshi Nognal" }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    for (let t of teamsData) {
      // Create random id
      let teamId = 'TEA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      
      // Generate a deterministic-ish login code based on name length + random
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await Team.findOneAndUpdate(
        { teamName: t.name },
        { 
          id: teamId,
          teamId, 
          teamName: t.name, 
          members: t.members,
          loginCode: code
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('Inserted:', t.name);
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
