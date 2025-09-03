-- MySQL dump 10.13  Distrib 9.3.0, for macos14.7 (arm64)
--
-- Host: localhost    Database: nfaa
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` char(36) NOT NULL,
  `actor_user_id` char(36) NOT NULL,
  `action` varchar(64) NOT NULL,
  `entity_type` varchar(32) NOT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `meta_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_actor_time` (`actor_user_id`,`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follows`
--

DROP TABLE IF EXISTS `follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follows` (
  `follower_id` char(36) NOT NULL,
  `following_id` char(36) NOT NULL,
  PRIMARY KEY (`follower_id`,`following_id`),
  KEY `following_id` (`following_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follows`
--

LOCK TABLES `follows` WRITE;
/*!40000 ALTER TABLE `follows` DISABLE KEYS */;
INSERT INTO `follows` VALUES ('8bfc8d18-85cd-11f0-a3f8-df6b7b264d0f','8bfc7206-85cd-11f0-a3f8-df6b7b264d0f');
/*!40000 ALTER TABLE `follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `references_links`
--

DROP TABLE IF EXISTS `references_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `references_links` (
  `id` char(36) NOT NULL,
  `stock_id` char(36) NOT NULL,
  `added_by_user_id` char(36) DEFAULT NULL,
  `url` varchar(2048) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ref_stock` (`stock_id`),
  KEY `fk_ref_added_by` (`added_by_user_id`),
  CONSTRAINT `fk_ref_added_by` FOREIGN KEY (`added_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ref_stock` FOREIGN KEY (`stock_id`) REFERENCES `stocks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `references_links`
--

LOCK TABLES `references_links` WRITE;
/*!40000 ALTER TABLE `references_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `references_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_user` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('32f9680d-19b0-435e-b88f-8ba4d11eddb5','8bfc8d18-85cd-11f0-a3f8-df6b7b264d0f','2025-09-01 22:29:01','2025-09-08 22:29:02'),('60940603-d4ad-48bf-bd48-19be825e8eca','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-02 12:26:35','2025-09-09 12:26:35'),('7e045789-c85e-4b69-8a58-2b19e45c365a','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 22:27:26','2025-09-08 22:27:27'),('b1d7004e-123f-434b-a90b-df9b8f73d1e0','8bfc7206-85cd-11f0-a3f8-df6b7b264d0f','2025-09-01 22:28:38','2025-09-08 22:28:39'),('c342bc37-468f-4d69-81e1-c286976e4939','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-02 12:26:35','2025-09-09 12:26:35'),('f5412bed-24b7-4614-b554-9b50984a4cad','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 13:23:01','2025-09-08 13:23:01');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_calls`
--

DROP TABLE IF EXISTS `stock_calls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_calls` (
  `id` char(36) NOT NULL,
  `stock_id` char(36) NOT NULL,
  `opened_by_user_id` char(36) NOT NULL,
  `closed_by_user_id` char(36) DEFAULT NULL,
  `entry` decimal(12,4) NOT NULL,
  `stop` decimal(12,4) NOT NULL,
  `t1` decimal(12,4) DEFAULT NULL,
  `t2` decimal(12,4) DEFAULT NULL,
  `t3` decimal(12,4) DEFAULT NULL,
  `horizon_days` int NOT NULL,
  `opened_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `outcome` enum('target_hit','stop_hit','expired','cancelled') DEFAULT NULL,
  `which_target_hit` tinyint DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `close_price` decimal(12,4) DEFAULT NULL,
  `result_pct` decimal(6,2) DEFAULT NULL,
  `notes` text,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_stock_status` (`stock_id`,`status`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_calls_opened_by` (`opened_by_user_id`),
  KEY `idx_calls_closed_by` (`closed_by_user_id`),
  CONSTRAINT `fk_call_closed_by` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_call_opened_by` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_call_stock` FOREIGN KEY (`stock_id`) REFERENCES `stocks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_calls`
--

LOCK TABLES `stock_calls` WRITE;
/*!40000 ALTER TABLE `stock_calls` DISABLE KEYS */;
INSERT INTO `stock_calls` VALUES ('050ae46e-4f27-4f49-853d-6aab13c4b947','45f37a34-1505-430d-aff6-8759cf8f62ba','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,51.0000,45.9000,70.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('0a56e7fd-89fc-4bdd-92ad-a72c06d0131b','4b43d2b0-9ed5-4c72-a547-6690390243fb','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,275.0000,247.5000,320.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('0a7c4aa2-58f8-41c0-ae14-4c9a871dbe4e','7eff4756-4002-44db-ad69-ff334463bc47','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,35.7000,32.1300,39.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('0ed50445-92e7-4fc2-a307-e4eb1d3f29fd','6ca829e6-feff-42bd-8672-edd30addff8a','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.9000,7.1100,9.5000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('15b3aff0-85c4-11f0-a3f8-df6b7b264d0f','10318872-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,100.0000,92.0000,105.0000,110.0000,120.0000,7,'2025-08-30 17:09:27','2025-09-06 17:09:27','closed','target_hit',1,'2025-08-30 17:10:34',105.0000,5.00,NULL,0),('167f17f6-4f57-4c8a-9754-a9e255e240dc','26930ca5-b17f-4443-b581-d0f0e4bcb646','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,29.6200,26.6580,40.0000,NULL,NULL,30,'2025-09-03 11:48:34',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('178d87cf-e8ef-4bd7-8314-ba1c798ee4cd','0107c040-c89f-41ec-ba0d-9f470984ad5c','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',42.0000,40.0000,60.0000,NULL,NULL,30,'2025-08-30 23:22:44',NULL,'closed','stop_hit',NULL,'2025-08-30 23:29:18',40.0000,-4.76,NULL,0),('1901f598-adbf-4a4a-ad58-ea5354c589a5','fcdc95cf-5d1f-4819-b0ca-46ddb5078588','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,6.1800,5.5620,8.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('207b6e08-d3fb-4809-8f34-fe1361cde37d','90652938-5c84-4a0c-b38d-b56d0ec1e0b7','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,1.4000,1.2600,2.2000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('25a84c45-0187-4ed4-8746-d9183f4cf476','24fa4daa-d431-4030-8464-e7d5ff0017cf','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',2.0900,1.8810,2.9000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'closed','expired',NULL,'2025-09-02 13:38:04',NULL,NULL,NULL,0),('31a86c17-8924-4aca-9f01-88e0ed222bbf','9e5245c0-9bef-4fbc-a70c-62eb3498ea11','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,205.0000,184.5000,225.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('31e73f8f-cf64-41d7-9821-5633d57d5c81','d3d705dc-8db2-49ea-b318-d7026bbd48be','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,5.2500,4.7250,5.9000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('391e0088-f1d6-4593-964a-87c2b7d5bfa1','b02aa80e-1cb8-45f4-a01e-9f99c6657a40','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,15.5200,13.9680,21.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('46d19843-505f-4b0d-b828-9e6eda2e0a45','aa41035a-86e0-4ca7-8f73-dbc7d03222e2','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,56.0000,50.4000,62.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('47c851c4-14a7-4985-9691-6d28d28c0129','fa29d9e1-576c-4e2f-b4c4-32e02db69f5f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,1.5500,1.3950,2.1000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('4838bd65-430a-4167-9176-0d369317c803','0c70df8a-7771-442f-a085-d4b8b6129212','8bfc7206-85cd-11f0-a3f8-df6b7b264d0f',NULL,173.0000,155.7000,200.0000,NULL,NULL,30,'2025-09-01 22:26:50',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('491d1173-3175-4d02-9c07-828edb67c889','91b06817-41fd-4842-a4ee-a8f7489d59f1','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,9.0000,8.1000,13.0000,NULL,NULL,30,'2025-09-03 09:35:11',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('4bf1d4ef-59b2-479d-9160-b252a98426ac','0107c040-c89f-41ec-ba0d-9f470984ad5c','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,44.0000,39.6000,77.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('562d6aae-d6ce-42b4-af9d-67e3dc7ccd85','183566a7-57db-4267-80e2-32d292cf6be7','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,40.0000,36.0000,50.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('571d9c2d-d67c-4ca9-b709-69219b2cfc6a','d3cbff7c-7e57-4c6f-8820-e4de9142448d','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,6.9000,6.2100,8.8000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('5fd5d83a-dfa5-4471-9a4e-69b9cab93e8f','64784ed5-0558-4124-90ee-618c07bd6e35','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,3.9000,3.5100,4.5000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('6346277b-5c26-4e37-92e2-e0b9d3397f03','eb0052ed-c85b-4e1e-b55b-92043c7878c7','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,18.0000,16.2000,22.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('63b5e7be-49f9-44cd-9878-5b6cd6fd9f88','0099c38a-d1ea-4853-9460-e150a3ce5fc5','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,3.2400,2.9160,4.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('648f07f5-ed25-4f27-a861-dfab1f4bf93d','eac4c358-620b-419b-823f-05bd1b8a5a02','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,21.0000,18.9000,30.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('6b1dfcdb-8ddc-4cab-86c3-8c118145a449','c547fb07-e13e-43a6-b1b1-28c6452a5804','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.1800,6.4620,10.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('6e74f79a-0da3-46a7-b963-22fe6a4630f9','94856a67-1389-4f62-aa87-20d82742fb3b','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,16.5000,14.8500,19.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('6f092da8-a5c5-4924-8079-563a1ebbfdbf','7a7d1d5c-31db-4cb9-b393-d9ee05d0f9cb','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,14.0000,12.6000,17.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('72d569ef-474d-44d0-bd5e-b7960693f3b2','56bf9960-7df2-48be-a32a-81e9fdd8193f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',3.8000,3.4200,4.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'closed','target_hit',1,'2025-09-02 13:34:31',4.0000,5.26,NULL,0),('75437d62-a0c9-468c-b09a-e569b1e55e78','d8c2eec7-9d73-48f6-b2dd-5ba0bd54982f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,8.9000,8.0100,11.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('78d5e377-a0f2-4e95-b620-1b652861da53','3f486928-f9f4-4872-b057-7b9c2ba191c1','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,197.0000,177.3000,220.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('7dbe49e3-198e-4221-af66-0b0f38756855','96d30002-c8f2-4133-9fe9-aae2389c5859','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,14.9000,13.4100,18.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('897d6fbd-bc4c-4ebb-a91d-35e62b357d33','e040c034-ccd1-42da-ae71-4faf27cd16ea','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.5000,6.7500,10.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('8afa76d6-cbdb-49ee-bcc2-d3c9aea0a4d8','c9a7e78d-b368-4714-9a19-f64b2935292f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,3.1300,2.8170,3.8000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('8e0b2341-d252-43aa-bb2b-87df1cb039ea','c547fb07-e13e-43a6-b1b1-28c6452a5804','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.1800,6.4620,10.0000,NULL,NULL,30,'2025-09-01 15:20:02',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('9245e44e-44ae-4023-87b0-f3d89f575f2e','f9d4f263-4e5d-4585-9750-09990c5d3256','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,16.0000,14.4000,21.5000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('99f94946-3419-4105-ad73-b70c12272d23','c67f45d7-2e47-4326-8e97-ab4af36a537b','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,125.0000,112.5000,140.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('9a1c49aa-9d3c-4903-bc51-17ff65ab8835','2a2dbe8b-9eee-45bd-b9ab-730254f5612e','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',325.0000,320.0000,380.0000,NULL,NULL,30,'2025-08-31 00:04:19',NULL,'closed','stop_hit',NULL,'2025-08-31 00:26:47',320.0000,-1.54,NULL,0),('9efdaf6a-adef-4f7d-8072-a944912b8b6c','059980c5-7c57-442c-b928-f088e62e0155','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,13.4500,12.1050,16.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('a21b3429-3814-4ae4-bc58-a466244c60c6','2a53079c-8924-49a5-99cd-fc2a5feaf5b5','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.1500,6.4350,10.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('a7c25fb0-7a76-4c93-8a68-2f31c675cefb','1251b6a1-96ec-4080-9cf1-5e5fcecab577','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,54.0000,48.6000,63.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('ac885083-9ee8-45e4-91c5-88d9649871d1','b7921488-e876-4818-9273-d262571e3318','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,75.0000,67.5000,82.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('aef80582-0a67-4628-88cc-4c16d8ebc1c6','0099c38a-d1ea-4853-9460-e150a3ce5fc5','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,3.2400,3.0000,4.0000,NULL,NULL,30,'2025-08-31 00:21:49',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('b0cf1dd1-0349-47da-8fbf-051204399e55','7c675b56-d8c6-48db-808e-48d75e9c5774','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,1.9300,1.7370,2.3000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('b8e402ac-63c8-4749-955f-066f692c60e3','91fb9b11-53ff-4074-acdb-bf445710cef4','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,9.0000,8.1000,12.5000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('b910a761-6fc4-4279-b23d-98bd64edabd7','69074a80-a4cf-4041-8836-29c162d6e4ec','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,46.6700,42.0030,62.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('ba778e94-e626-4f83-ac9f-19d092efa457','eee0fbc7-8eae-44a5-9a04-e72c0a4f38c1','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,4.4700,4.0230,5.3000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('bd5713db-71dc-4482-a474-745a6b282b4c','2a2dbe8b-9eee-45bd-b9ab-730254f5612e','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,325.0000,292.5000,380.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,1),('bdbd644a-4dc4-4e5c-a266-62d4b87d855d','1b61f5ac-2683-44d2-9195-65f15d37cfca','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,87.0000,78.3000,100.0000,NULL,NULL,30,'2025-09-03 12:23:49',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,1),('c47ec052-de20-4576-8e09-795664064fd2','94856a67-1389-4f62-aa87-20d82742fb3b','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',10.0000,9.0000,20.0000,NULL,NULL,30,'2025-08-30 18:58:35',NULL,'closed','stop_hit',NULL,'2025-08-30 19:29:53',9.0000,-10.00,NULL,0),('cdb3e448-479f-4b2d-9870-46d8e06edd9a','b5a0d16b-cdda-47b7-9905-f40f705d2579','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,644.0000,579.6000,900.0000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('cec401b0-baee-4b68-9524-bb547b84c5f7','e8fd73f3-81d6-4257-a009-24a0f635d49f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,7.5500,6.7950,10.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('d6cd503a-5ec4-4a2e-a79c-70ef995997bc','7eea54fa-f517-4d12-8f47-186efa67aee1','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,90.0000,81.0000,100.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('d758e6e3-fb90-4cef-9b18-c0ccc2ddb439','9544c847-9302-4ab6-87a0-67fb88f07575','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,23.7000,21.3300,28.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('e24e4f42-dcde-4838-93d2-9a23c0213a79','17cff33f-3161-449a-b83a-b181cb3ba7cd','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,16.2500,14.6250,22.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('e38e9f2a-1b2a-4750-a484-e3e839bab6e8','a082e1fd-1fef-4c9d-b54c-d374b01031e9','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,1.1300,1.0170,1.4500,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('ebf77f26-85a2-4429-a1ba-94fa37f73fdc','4170d9e3-6b02-4d2c-ad61-e3efc40e51c2','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,340.0000,306.0000,415.0000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('eefe8c0a-3ddf-4fb5-a06f-2faba2e48134','029329cd-0229-4253-9a57-8e56dbfde5d9','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,3.1400,2.8260,4.1000,NULL,NULL,30,'2025-09-01 15:43:31',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('f7a32f57-078c-465a-8a2f-81efba84aa20','452e8965-de48-4bff-843f-6720fed7cca3','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,4.5500,4.0950,5.5000,NULL,NULL,30,'2025-09-01 15:43:30',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0),('fa674a52-5de6-45ae-b3d0-5d3f9a198eba','f9d4f263-4e5d-4585-9750-09990c5d3256','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,16.0000,14.0000,21.5000,NULL,NULL,30,'2025-09-01 13:17:26',NULL,'open',NULL,NULL,NULL,NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `stock_calls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_details`
--

DROP TABLE IF EXISTS `stock_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_details` (
  `stock_id` char(36) NOT NULL,
  `technical_json` json DEFAULT NULL,
  `fundamental_json` json DEFAULT NULL,
  `sentiment` enum('bullish','bearish','neutral') DEFAULT 'neutral',
  `score_total` tinyint DEFAULT NULL,
  `updated_by_user_id` char(36) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stock_id`),
  KEY `fk_details_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_details_stock` FOREIGN KEY (`stock_id`) REFERENCES `stocks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_details_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_details`
--

LOCK TABLES `stock_details` WRITE;
/*!40000 ALTER TABLE `stock_details` DISABLE KEYS */;
INSERT INTO `stock_details` VALUES ('0099c38a-d1ea-4853-9460-e150a3ce5fc5',NULL,NULL,'bullish',NULL,'0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 12:44:38'),('0107c040-c89f-41ec-ba0d-9f470984ad5c',NULL,NULL,'bullish',NULL,'0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-08-30 23:20:46');
/*!40000 ALTER TABLE `stock_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stocks`
--

DROP TABLE IF EXISTS `stocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stocks` (
  `id` char(36) NOT NULL,
  `ticker` varchar(16) NOT NULL,
  `market` varchar(16) NOT NULL DEFAULT 'US',
  `name` varchar(190) DEFAULT NULL,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `created_by_user_id` char(36) NOT NULL,
  `owner_analyst_user_id` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ticker_market` (`ticker`,`market`),
  KEY `idx_status` (`status`),
  KEY `fk_stocks_user` (`created_by_user_id`),
  KEY `fk_stocks_owner` (`owner_analyst_user_id`),
  CONSTRAINT `fk_stocks_owner` FOREIGN KEY (`owner_analyst_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stocks_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stocks`
--

LOCK TABLES `stocks` WRITE;
/*!40000 ALTER TABLE `stocks` DISABLE KEYS */;
INSERT INTO `stocks` VALUES ('0099c38a-d1ea-4853-9460-e150a3ce5fc5','RZLV','US','Rezolve AI PLC','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-31 00:21:22','2025-08-31 00:21:22'),('0107c040-c89f-41ec-ba0d-9f470984ad5c','HIMS','US','Hims & Hers Health, Inc.','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-30 23:15:50','2025-09-01 15:43:30'),('029329cd-0229-4253-9a57-8e56dbfde5d9','RR','US','Richtech Robotics Inc.','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-31 19:48:37','2025-08-31 19:48:37'),('059980c5-7c57-442c-b928-f088e62e0155','DNA','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('0c70df8a-7771-442f-a085-d4b8b6129212','NVDA','US',NULL,'active','8bfc7206-85cd-11f0-a3f8-df6b7b264d0f','8bfc7206-85cd-11f0-a3f8-df6b7b264d0f','2025-09-01 22:26:50','2025-09-01 22:26:50'),('10318872-85c4-11f0-a3f8-df6b7b264d0f','AAPL','US','Apple Inc.','archived','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-08-30 17:09:18','2025-08-30 22:06:27'),('1251b6a1-96ec-4080-9cf1-5e5fcecab577','LMND','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('17cff33f-3161-449a-b83a-b181cb3ba7cd','RGTI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('183566a7-57db-4267-80e2-32d292cf6be7','INOD','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('1b61f5ac-2683-44d2-9195-65f15d37cfca','GPN','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-03 12:23:49','2025-09-03 12:23:49'),('24fa4daa-d431-4030-8464-e7d5ff0017cf','LCID','US',NULL,'archived','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-02 13:38:04'),('26930ca5-b17f-4443-b581-d0f0e4bcb646','CNC','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-03 11:48:34','2025-09-03 11:48:34'),('2a2dbe8b-9eee-45bd-b9ab-730254f5612e','DUOL','US','Duolingo, Inc.','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-31 00:03:47','2025-09-01 15:43:30'),('2a53079c-8924-49a5-99cd-fc2a5feaf5b5','AMPX','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('3559589a-bbfe-4e0e-b0cc-3ff902d226c6','COIN','US','Coinbase Global, Inc.','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-30 23:58:30','2025-08-30 23:58:30'),('3f486928-f9f4-4872-b057-7b9c2ba191c1','FSLR','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('4170d9e3-6b02-4d2c-ad61-e3efc40e51c2','MSTR','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('452e8965-de48-4bff-843f-6720fed7cca3','ABCL','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('45f37a34-1505-430d-aff6-8759cf8f62ba','TTD','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('4b43d2b0-9ed5-4c72-a547-6690390243fb','UNH','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('56bf9960-7df2-48be-a32a-81e9fdd8193f','AMBO','US',NULL,'archived','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-02 13:34:31'),('64784ed5-0558-4124-90ee-618c07bd6e35','AMPY','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('69074a80-a4cf-4041-8836-29c162d6e4ec','SMCI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('6ca829e6-feff-42bd-8672-edd30addff8a','VNET','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('7a7d1d5c-31db-4cb9-b393-d9ee05d0f9cb','PCT','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('7c675b56-d8c6-48db-808e-48d75e9c5774','BLDP','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('7eea54fa-f517-4d12-8f47-186efa67aee1','SEZL','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('7eff4756-4002-44db-ad69-ff334463bc47','SMR','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('90652938-5c84-4a0c-b38d-b56d0ec1e0b7','LOOP','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('91b06817-41fd-4842-a4ee-a8f7489d59f1','LHAI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-03 09:35:11','2025-09-03 09:35:11'),('91fb9b11-53ff-4074-acdb-bf445710cef4','NVAX','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('94856a67-1389-4f62-aa87-20d82742fb3b','APLD','‎‏US','Apld','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-08-30 18:39:14','2025-09-01 15:43:30'),('9544c847-9302-4ab6-87a0-67fb88f07575','HSAI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('96d30002-c8f2-4133-9fe9-aae2389c5859','QUBT','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('9e5245c0-9bef-4fbc-a70c-62eb3498ea11','ALL','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('a082e1fd-1fef-4c9d-b54c-d374b01031e9','LCTX','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('aa41035a-86e0-4ca7-8f73-dbc7d03222e2','BMNR','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('b02aa80e-1cb8-45f4-a01e-9f99c6657a40','LYFT','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('b5a0d16b-cdda-47b7-9905-f40f705d2579','LLY','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('b7921488-e876-4818-9273-d262571e3318','OKLO','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('c547fb07-e13e-43a6-b1b1-28c6452a5804','SNAP','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:20:02','2025-09-01 15:20:02'),('c67f45d7-2e47-4326-8e97-ab4af36a537b','MU','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('c9a7e78d-b368-4714-9a19-f64b2935292f','AMPG','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('d3cbff7c-7e57-4c6f-8820-e4de9142448d','BBAI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('d3d705dc-8db2-49ea-b318-d7026bbd48be','VNTG','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('d8c2eec7-9d73-48f6-b2dd-5ba0bd54982f','WULF','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('e040c034-ccd1-42da-ae71-4faf27cd16ea','XERS','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('e8fd73f3-81d6-4257-a009-24a0f635d49f','TDOC','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('eac4c358-620b-419b-823f-05bd1b8a5a02','TSSI','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('eb0052ed-c85b-4e1e-b55b-92043c7878c7','QBTS','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('eee0fbc7-8eae-44a5-9a04-e72c0a4f38c1','UAMY','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:31','2025-09-01 15:43:31'),('f9d4f263-4e5d-4585-9750-09990c5d3256','QURE','US','uniQure N.V.','active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f',NULL,'2025-09-01 13:15:24','2025-09-01 13:15:24'),('fa29d9e1-576c-4e2f-b4c4-32e02db69f5f','INVZ','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30'),('fcdc95cf-5d1f-4819-b0ca-46ddb5078588','EOSE','US',NULL,'active','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','2025-09-01 15:43:30','2025-09-01 15:43:30');
/*!40000 ALTER TABLE `stocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `email` varchar(190) NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `password_hash` varchar(100) NOT NULL,
  `role` enum('admin','analyst','viewer') NOT NULL DEFAULT 'viewer',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uniq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('0b9b59fa-85c4-11f0-a3f8-df6b7b264d0f','admin@nfaa.local',NULL,'$2b$12$.0zYFKXkXwcx3sOnZb2qNuByyb/8jPEmDCEZ88JKxepg.X97mnS.C','admin','2025-08-30 17:09:10',NULL),('582a4b91-7022-4884-bcc1-eab244a62cb1','mohamedabdelshakor1@gmail.com','moo','$2b$10$uYe5YiCsULaTLyTpPZC6FOUw.NbcMR88K05IkfsTCc6OKuUgYj3me','analyst','2025-09-02 13:50:32',NULL),('8bfc7206-85cd-11f0-a3f8-df6b7b264d0f','analyst1@nfaa.local',NULL,'$2b$12$IA6b1a570dBsosWMwuDZQO1T19ylgbnRk/P9yuuUu2seFW4.H02HO','analyst','2025-08-30 18:17:11',NULL),('8bfc8d18-85cd-11f0-a3f8-df6b7b264d0f','viewer1@nfaa.local',NULL,'$2b$12$1pXZ5CUcJmk7uuy7638aveuAojN4Ehjm4vbuAIZkHUtvGbF4sEVrG','viewer','2025-08-30 18:17:11',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-03 16:00:28
