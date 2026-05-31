import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'

import { AuthModule } from './auth/auth.module'
import { PrismaModule } from './prisma/prisma.module'
import { UsersModule } from './users/users.module'
import { WatchlistModule } from './watchlist/watchlist.module'
import { AlertsModule } from './alerts/alerts.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    WatchlistModule,
    AlertsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
