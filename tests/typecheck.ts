import {
  date,
  equals,
  isIn,
  loginUser,
  organizationSelect,
  primaryOrganization,
  text,
  thisMonth,
  time,
  today,
  userSelect,
} from "../src/index.ts";

equals(date("DueDate"), today());
equals(date("DueDate"), thisMonth());
isIn(userSelect("Assignee"), loginUser());
isIn(organizationSelect("Department"), primaryOrganization());

// @ts-expect-error text fields do not accept temporal query functions
equals(text("Title"), today());

// @ts-expect-error time fields do not accept temporal query functions
equals(time("ClockIn"), today());

// @ts-expect-error user selection fields do not accept PRIMARY_ORGANIZATION()
isIn(userSelect("Assignee"), primaryOrganization());

// @ts-expect-error organization selection fields do not accept LOGINUSER()
isIn(organizationSelect("Department"), loginUser());

// @ts-expect-error collection operators accept either literal arrays or a single query function
isIn(userSelect("Assignee"), [loginUser()]);
