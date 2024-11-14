import { getPlateReads } from '@/lib/db';
import PlateTable from '@/components/PlateTable';
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardLayout from '@/components/layout/MainLayout';
import { redirect } from 'next/navigation';

export default async function Home() {
  redirect('/dashboard');
}

// todo: 
//use flag icon for watchlist and camera icon for live feed.
//either tooltip or modal to click on camera image and view jpeg
//download csv functionality
//push notif and email
//code audit
//Plate reads vs plate database. Reads show live activity. does not show frequency etc. Db has on entry per plate, shows other info etc.
// show frequency in dashboard as state danger colors sliding bar. and rename to frequency
//db section has all the advanced sorting features
//allow set mode in settings for mqtt or http
//set rules to reject non plate ocr reads
//Consider doing the nice dribble style sub title nav in the db page with options to create/manage tags, do similarity matching/partial reading. The content of the nav should be *features* not settings or config.
//add some metrics at the top like number of plates today, week, etc. Traffic: medium. 10 cars / hour. Many unfamiliar cars...
//         Add ability to give a plate a Name with "known plates"
//         change tag to "flag"
//         view a plate and see just its history in a table or modal. Click plate num to open this.
//         settings page to configure everything + setup notifications + set retention policy
//         left navbar
//         discard mqtt msgs that dont contain a plate value. Solves issue of no label for alpr in cp2.9
//         add a "last seen" column to the table
//         ability to share your plates / db with others
//         honestly could make money off this. Not much but idk. Make it free for short retention on vercel and charge small fee for longer retention.
//         add a "notes" column to the table
//         add a "location" column to the table. This will be valuable for multi cam. Enable multi cam in settings then get their cam number and names from db
//         make sure partial plate matches work. Can use a similarlity algo/fuzzy to show possible matches.
//         filter by time. See what cars are past midnight for ex.
//         Export and backup ability
//         auth/login
//         ability to invite others with perms if we do vercel.
//         ensure sql inputs are sanitized.