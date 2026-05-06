import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.mysql.prisma",
  datasource: {
    url: process.env["MYSQL_DATABASE_URL"]
      ?? "mysql://kerisi:kerisi123@43.217.187.42:4151/testagent",
  },
});
