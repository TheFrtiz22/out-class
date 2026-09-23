import type { Notification } from "@/lib/data"

export const demoNotifications: Notification[] = [
  {
    id: "n-1", type: "Announcement", urgent: false, club: "Virginia Venture Fund", color: "#232D4B", logoText: "VVF", senderName: "VVF Recruitment", senderTitle: "Exec Team",
    title: "Your application to VVF has been received", preview: "Thank you for applying. We will review...", body: ["Thank you for applying to Virginia Venture Fund.", "Our team will review your application shortly and get back to you."], timestamp: "2 hours ago", fullDate: "Sample Date", read: false
  },
  {
    id: "n-2", type: "Announcement", urgent: false, club: "180 Degrees Consulting", color: "#EAAA00", logoText: "180DC", senderName: "180DC Recruitment", senderTitle: "Exec Team",
    title: "Your application to 180DC has been received", preview: "Thanks for submitting your app...", body: ["Thanks for submitting your app.", "We'll be in touch."], timestamp: "Yesterday", fullDate: "Sample Date", read: true
  },
  {
    id: "n-3", type: "Announcement", urgent: false, club: "McIntire Investment Institute", color: "#1B5E3F", logoText: "MII", senderName: "MII Recruitment", senderTitle: "Exec Team",
    title: "Your application to MII has been received", preview: "We have received your application materials.", body: ["We have received your application materials."], timestamp: "3 days ago", fullDate: "Sample Date", read: true
  },

  {
    id: "n-4", type: "Interview Invite", urgent: true, club: "Virginia Venture Fund", color: "#232D4B", logoText: "VVF", senderName: "VVF Recruitment", senderTitle: "Exec Team",
    title: "Action Required: Interview Invite", preview: "Congratulations, you have been selected...", body: ["Congratulations, you have been selected for a Round 1 interview.", "Please select a time slot."], timestamp: "4 hours ago", fullDate: "Sample Date", read: false, cta: "Schedule Interview"
  },
  {
    id: "n-5", type: "Interview Invite", urgent: true, club: "TAMID", color: "#A6192E", logoText: "TAMID", senderName: "TAMID Recruitment", senderTitle: "Exec Team",
    title: "Action Required: Interview Invite", preview: "We would like to invite you to interview.", body: ["We would like to invite you to interview."], timestamp: "1 day ago", fullDate: "Sample Date", read: false, cta: "Schedule Interview"
  },
  {
    id: "n-6", type: "Interview Invite", urgent: true, club: "Alpha Kappa Psi", color: "#EAAA00", logoText: "AKPsi", senderName: "AKPsi Recruitment", senderTitle: "Exec Team",
    title: "Action Required: Group Interview", preview: "Please sign up for a group interview slot.", body: ["Please sign up for a group interview slot."], timestamp: "2 days ago", fullDate: "Sample Date", read: true, cta: "Schedule Interview"
  },

  {
    id: "n-7", type: "Announcement", urgent: true, club: "Portico Impact Fund", color: "#0B63E5", logoText: "PIF", senderName: "Portico Recruitment", senderTitle: "Exec Team",
    title: "Deadline Reminder", preview: "Your application is due in 24 hours.", body: ["Your application is due in 24 hours.", "Please ensure all materials are submitted."], timestamp: "5 hours ago", fullDate: "Sample Date", read: false
  },
  {
    id: "n-8", type: "Announcement", urgent: true, club: "SEED", color: "#1B5E3F", logoText: "SEED", senderName: "SEED Recruitment", senderTitle: "Exec Team",
    title: "Deadline Reminder", preview: "Resume drop closes soon.", body: ["Resume drop closes soon."], timestamp: "Yesterday", fullDate: "Sample Date", read: false
  },
  {
    id: "n-9", type: "Announcement", urgent: true, club: "Virginia Consulting Group", color: "#232D4B", logoText: "VCG", senderName: "VCG Recruitment", senderTitle: "Exec Team",
    title: "Deadline Reminder", preview: "Round 1 application deadline approaching.", body: ["Round 1 application deadline approaching."], timestamp: "2 days ago", fullDate: "Sample Date", read: true
  },

  {
    id: "n-10", type: "Announcement", urgent: false, club: "Virginia Venture Fund", color: "#232D4B", logoText: "VVF", senderName: "VVF Recruitment", senderTitle: "Exec Team",
    title: "Location Change for Interview", preview: "Please note the new location.", body: ["Please note the new location for your upcoming interview."], timestamp: "1 hour ago", fullDate: "Sample Date", read: false, locationChange: { oldLocation: "Rouss Hall 411", newLocation: "Rouss Hall 414" }
  },
  {
    id: "n-11", type: "Announcement", urgent: false, club: "180 Degrees Consulting", color: "#EAAA00", logoText: "180DC", senderName: "180DC Recruitment", senderTitle: "Exec Team",
    title: "Room Change for Info Session", preview: "Our info session tonight has moved.", body: ["Our info session tonight has moved."], timestamp: "6 hours ago", fullDate: "Sample Date", read: true, locationChange: { oldLocation: "Clark 107", newLocation: "Clark 108" }
  },

  {
    id: "n-12", type: "Announcement", urgent: false, club: "Global Markets Group", color: "#0B63E5", logoText: "GMG", senderName: "GMG Exec", senderTitle: "Exec Team",
    title: "General Announcement", preview: "Thanks to everyone who attended...", body: ["Thanks to everyone who attended our first info session.", "We look forward to reading your applications."], timestamp: "3 days ago", fullDate: "Sample Date", read: true
  },
  {
    id: "n-13", type: "Announcement", urgent: false, club: "American Marketing Association", color: "#0B63E5", logoText: "AMA", senderName: "AMA Exec", senderTitle: "Exec Team",
    title: "Upcoming Workshop", preview: "Join us for a resume workshop this Friday.", body: ["Join us for a resume workshop this Friday."], timestamp: "4 days ago", fullDate: "Sample Date", read: true
  },

  {
    id: "n-14", type: "Announcement", urgent: false, club: "Alternative Investment Fund", color: "#1B5E3F", logoText: "AIF", senderName: "AIF Rep", senderTitle: "Member",
    title: "Coffee Chat Confirmed", preview: "Your coffee chat with Alex has been confirmed.", body: ["Your coffee chat with Alex has been confirmed.", "See you at Grit Coffee!"], timestamp: "1 day ago", fullDate: "Sample Date", read: false
  },
  {
    id: "n-15", type: "Announcement", urgent: false, club: "McIntire Investment Institute", color: "#1B5E3F", logoText: "MII", senderName: "MII Rep", senderTitle: "Member",
    title: "Coffee Chat Confirmed", preview: "Your coffee chat with Jordan is confirmed.", body: ["Your coffee chat with Jordan is confirmed."], timestamp: "2 days ago", fullDate: "Sample Date", read: true
  }
];
