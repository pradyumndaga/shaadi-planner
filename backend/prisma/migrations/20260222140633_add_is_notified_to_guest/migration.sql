-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "roomId" INTEGER,
    "travelPlanId" INTEGER,
    "arrivalTime" DATETIME,
    "arrivalFlightNo" TEXT,
    "arrivalPnr" TEXT,
    "departureTime" DATETIME,
    "departureFlightNo" TEXT,
    "departurePnr" TEXT,
    "isNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Guest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Guest_travelPlanId_fkey" FOREIGN KEY ("travelPlanId") REFERENCES "TravelPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Guest" ("arrivalFlightNo", "arrivalPnr", "arrivalTime", "createdAt", "departureFlightNo", "departurePnr", "departureTime", "gender", "id", "mobile", "name", "roomId", "travelPlanId", "updatedAt", "userId") SELECT "arrivalFlightNo", "arrivalPnr", "arrivalTime", "createdAt", "departureFlightNo", "departurePnr", "departureTime", "gender", "id", "mobile", "name", "roomId", "travelPlanId", "updatedAt", "userId" FROM "Guest";
DROP TABLE "Guest";
ALTER TABLE "new_Guest" RENAME TO "Guest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
