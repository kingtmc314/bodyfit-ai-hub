CREATE TABLE `ai_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`content` text NOT NULL,
	`type` enum('nutrition','workout','recovery','overall') DEFAULT 'overall',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `body_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`weight` float,
	`bmi` float,
	`bodyFatPct` float,
	`fatMass` float,
	`muscleMass` float,
	`bmr` float,
	`visceralFat` float,
	`notes` text,
	`source` varchar(64) DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `body_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameZh` varchar(255),
	`muscleGroup` varchar(64) NOT NULL,
	`equipment` varchar(64),
	`instructions` text,
	`isCustom` boolean DEFAULT false,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `food_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameZh` varchar(255),
	`calories` float NOT NULL,
	`protein` float NOT NULL,
	`carbs` float NOT NULL,
	`fat` float NOT NULL,
	`fiber` float,
	`sugar` float,
	`sodium` float,
	`category` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `food_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `heart_rate_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`restingHr` int,
	`highHr` int,
	`maxHr` int,
	`hrv` float,
	`notes` text,
	`source` varchar(64) DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `heart_rate_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`foodName` varchar(255) NOT NULL,
	`foodItemId` int,
	`quantity` float NOT NULL,
	`calories` float NOT NULL,
	`protein` float NOT NULL,
	`carbs` float NOT NULL,
	`fat` float NOT NULL,
	`fiber` float,
	`notes` text,
	`photoUrl` varchar(1024),
	`aiAnalyzed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`photoUrl` varchar(1024) NOT NULL,
	`photoKey` varchar(512) NOT NULL,
	`angle` enum('front','back','side_left','side_right','other') DEFAULT 'front',
	`weight` float,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `progress_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sleep_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`score` int,
	`restingHr` int,
	`bodyBattery` int,
	`pulseOx` float,
	`respiration` float,
	`stress` float,
	`quality` enum('Poor','Fair','Good','Excellent'),
	`duration` float,
	`deepSleep` float,
	`remSleep` float,
	`notes` text,
	`source` varchar(64) DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sleep_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`name` varchar(255),
	`duration` int,
	`notes` text,
	`totalVolume` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`exerciseId` int NOT NULL,
	`exerciseName` varchar(255) NOT NULL,
	`setNumber` int NOT NULL,
	`reps` int,
	`weight` float,
	`duration` int,
	`distance` float,
	`isPersonalRecord` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workout_sets_id` PRIMARY KEY(`id`)
);
