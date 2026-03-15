import { db } from "./db";
import { users, departments, complaints, comments, notifications, activityLogs } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seed() {
  try {
    const [{ count: userCount }] = await db.select({ count: count() }).from(users);
    if (Number(userCount) > 0) return;

    console.log("[seed] Seeding database...");

    const adminHash   = await bcrypt.hash("admin123", 10);
    const staffHash   = await bcrypt.hash("staff123", 10);
    const studentHash = await bcrypt.hash("student123", 10);

    const [admin] = await db.insert(users).values({
      name: "Dr. Admin Wilson",
      email: "admin@university.edu",
      password: adminHash,
      role: "admin",
      department: "Administration",
    }).returning();

    const [staff1] = await db.insert(users).values({
      name: "Prof. Sarah Johnson",
      email: "staff@university.edu",
      password: staffHash,
      role: "staff",
      department: "Computer Science",
    }).returning();

    const [staff2] = await db.insert(users).values({
      name: "Mr. David Chen",
      email: "david@university.edu",
      password: staffHash,
      role: "staff",
      department: "Finance",
    }).returning();

    const [student1] = await db.insert(users).values({
      name: "Alice Thompson",
      email: "student@university.edu",
      password: studentHash,
      role: "student",
      studentId: "STU2024001",
      department: "Computer Science",
    }).returning();

    const [student2] = await db.insert(users).values({
      name: "Bob Martinez",
      email: "bob@university.edu",
      password: studentHash,
      role: "student",
      studentId: "STU2024002",
      department: "Business",
    }).returning();

    const [student3] = await db.insert(users).values({
      name: "Carol Davis",
      email: "carol@university.edu",
      password: studentHash,
      role: "student",
      studentId: "STU2024003",
      department: "Engineering",
    }).returning();

    const deptRows = await db.insert(departments).values([
      { name: "Computer Science",      code: "CS",   description: "Department of Computer Science and IT",               headName: "Prof. Sarah Johnson", email: "cs@university.edu" },
      { name: "Finance & Accounts",    code: "FIN",  description: "Financial services and fee management",              headName: "Mr. David Chen",      email: "finance@university.edu" },
      { name: "Facilities Management", code: "FAC",  description: "Campus facilities, maintenance and infrastructure",  headName: "Ms. Lisa Parker",     email: "facilities@university.edu" },
      { name: "Student Affairs",       code: "SA",   description: "Student welfare, counseling and support services",   headName: "Dr. Mark Evans",      email: "student-affairs@university.edu" },
      { name: "Library",               code: "LIB",  description: "Central library and digital resources",             headName: "Ms. Jane Cooper",     email: "library@university.edu" },
      { name: "Hostel Administration", code: "HOST", description: "On-campus housing and hostel management",           headName: "Mr. Robert King",     email: "hostel@university.edu" },
    ]).returning();

    const [csDept, finDept, facDept, _saDept, libDept, hostDept] = deptRows;

    const year = new Date().getFullYear();
    const complaintRows = await db.insert(complaints).values([
      {
        ticketId: `UC-${year}-0001`,
        title: "Online exam portal crashes during submission",
        description: "The online examination portal consistently crashes when I try to submit my answers in the final 5 minutes. This has happened in 3 consecutive online exams. The timer continues running but the submission button becomes unresponsive. I had to refresh the page and lost 10 minutes of my last exam.",
        category: "it_support",
        status: "in_progress",
        priority: "urgent",
        studentId: student1.id,
        assignedStaff: staff1.id,
        departmentId: csDept.id,
      },
      {
        ticketId: `UC-${year}-0002`,
        title: "Scholarship payment delayed for 3 months",
        description: "My merit scholarship payment has not been processed for the last 3 months. I submitted all required documents in August and received confirmation, but the payment is still pending. This is causing significant financial hardship as I rely on this funding for accommodation and textbooks.",
        category: "financial",
        status: "assigned",
        priority: "high",
        studentId: student2.id,
        assignedStaff: staff2.id,
        departmentId: finDept.id,
      },
      {
        ticketId: `UC-${year}-0003`,
        title: "Broken air conditioning in Building B lecture halls",
        description: "The air conditioning systems in rooms B101, B102, and B103 have been non-functional for the past 2 weeks. With temperatures exceeding 35°C, the classrooms are extremely uncomfortable and affecting student concentration and attendance. Several students have complained of heat exhaustion.",
        category: "facilities",
        status: "pending",
        priority: "high",
        studentId: student3.id,
        departmentId: facDept.id,
      },
      {
        ticketId: `UC-${year}-0004`,
        title: "Grade dispute for Advanced Mathematics module",
        description: "I believe my final grade for MAT301 Advanced Mathematics is incorrect. My coursework average was 85% and I believe I performed well in the exam. The recorded grade of C seems inconsistent with my performance throughout the semester. I would like to request a review of my examination scripts.",
        category: "academic",
        status: "resolved",
        priority: "medium",
        studentId: student1.id,
        assignedStaff: staff1.id,
        departmentId: csDept.id,
        resolutionNotes: "After reviewing the examination scripts, a data entry error was discovered. The grade has been corrected to B+ and the academic registry has been notified. The student's transcript will be updated within 5 working days.",
      },
      {
        ticketId: `UC-${year}-0005`,
        title: "Library books not returned - system error",
        description: "I returned 4 books to the library on October 15th but the library management system still shows them as checked out under my account. I am being charged daily late fees incorrectly. I have the return receipts but the staff say they cannot manually update the system.",
        category: "library",
        status: "pending",
        priority: "medium",
        studentId: student2.id,
        departmentId: libDept.id,
      },
      {
        ticketId: `UC-${year}-0006`,
        title: "Hostel hot water supply issues in Block C",
        description: "Hot water has been unavailable in Block C hostel for the past 5 days. With winter approaching, this is a serious welfare concern for the 120 residents in this block. We have reported this to the hostel warden but no action has been taken. The boiler system appears to have failed completely.",
        category: "hostel",
        status: "in_progress",
        priority: "urgent",
        studentId: student3.id,
        assignedStaff: admin.id,
        departmentId: hostDept.id,
      },
    ]).returning();

    const [c1, c2, c3, c4, c5, c6] = complaintRows;

    await db.insert(comments).values([
      {
        complaintId: c1.id,
        userId: staff1.id,
        content: "We have identified the issue with the exam portal. The server was timing out during peak submission periods. Our IT team is implementing a queue-based submission system to prevent this. Expected to be live within 48 hours.",
        isInternal: false,
      },
      {
        complaintId: c1.id,
        userId: student1.id,
        content: "Thank you for the update. Will this fix be applied before the upcoming final exams next week?",
        isInternal: false,
      },
      {
        complaintId: c1.id,
        userId: staff1.id,
        content: "Need to coordinate with the exam office to potentially postpone until fix is confirmed. Escalating to admin.",
        isInternal: true,
      },
      {
        complaintId: c2.id,
        userId: staff2.id,
        content: "I have reviewed your scholarship application. The delay was caused by a verification issue with your bank account details. Please visit the Finance Office with your bank statement to expedite the process.",
        isInternal: false,
      },
      {
        complaintId: c4.id,
        userId: staff1.id,
        content: "We have completed the grade review. A data entry error was identified during the result compilation. Your corrected grade has been submitted to the Academic Registry.",
        isInternal: false,
      },
      {
        complaintId: c4.id,
        userId: student1.id,
        content: "Thank you very much! I'm glad the error was found. When will my updated transcript be available?",
        isInternal: false,
      },
      {
        complaintId: c6.id,
        userId: admin.id,
        content: "Emergency maintenance team has been dispatched. The main boiler heating element has failed and a replacement part has been ordered. Temporary portable heaters are being provided to all affected rooms today.",
        isInternal: false,
      },
    ]);

    // Seed activity logs
    await db.insert(activityLogs).values([
      { userId: student1.id, complaintId: c1.id, action: "complaint_created", description: `Complaint submitted: "Online exam portal crashes during submission"` },
      { userId: staff1.id,   complaintId: c1.id, action: "complaint_updated",  description: "status → in_progress, assigned staff updated" },
      { userId: student2.id, complaintId: c2.id, action: "complaint_created",  description: `Complaint submitted: "Scholarship payment delayed for 3 months"` },
      { userId: staff2.id,   complaintId: c2.id, action: "complaint_updated",  description: "status → assigned, assigned staff updated" },
      { userId: student3.id, complaintId: c3.id, action: "complaint_created",  description: `Complaint submitted: "Broken air conditioning in Building B lecture halls"` },
      { userId: student1.id, complaintId: c4.id, action: "complaint_created",  description: `Complaint submitted: "Grade dispute for Advanced Mathematics module"` },
      { userId: staff1.id,   complaintId: c4.id, action: "complaint_updated",  description: "status → resolved, resolution notes updated" },
      { userId: student3.id, complaintId: c6.id, action: "complaint_created",  description: `Complaint submitted: "Hostel hot water supply issues in Block C"` },
      { userId: admin.id,    complaintId: c6.id, action: "complaint_updated",  description: "status → in_progress, assigned staff updated" },
    ]);

    await db.insert(notifications).values([
      {
        userId: student1.id,
        type: "status_changed",
        title: "Complaint Status Updated",
        message: `Ticket ${c1.ticketId} status changed to in progress`,
        read: false,
        complaintId: c1.id,
      },
      {
        userId: student1.id,
        type: "comment_added",
        title: "New Comment on Your Complaint",
        message: `A staff member responded to ticket ${c1.ticketId}`,
        read: false,
        complaintId: c1.id,
      },
      {
        userId: student1.id,
        type: "resolved",
        title: "Complaint Resolved",
        message: `Ticket ${c4.ticketId} has been resolved`,
        read: true,
        complaintId: c4.id,
      },
      {
        userId: student2.id,
        type: "comment_added",
        title: "New Response on Your Complaint",
        message: `Finance team responded to ticket ${c2.ticketId}`,
        read: false,
        complaintId: c2.id,
      },
      {
        userId: staff1.id,
        type: "complaint_submitted",
        title: "New Complaint Submitted",
        message: `Ticket ${c3.ticketId}: Broken air conditioning in Building B`,
        read: false,
        complaintId: c3.id,
      },
    ]);

    console.log("[seed] Database seeded successfully ✓");
  } catch (err) {
    console.error("[seed] Error:", err);
  }
}
