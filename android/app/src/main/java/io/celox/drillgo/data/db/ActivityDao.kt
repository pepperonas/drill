package io.celox.drillgo.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ActivityDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(a: ActivityEntity)

    @Query("SELECT * FROM activities ORDER BY startTime DESC")
    fun observeAll(): Flow<List<ActivityEntity>>

    @Query("SELECT * FROM activities WHERE status = 'pending' ORDER BY startTime ASC")
    suspend fun pending(): List<ActivityEntity>

    @Query("SELECT * FROM activities WHERE clientUuid = :uuid")
    suspend fun byId(uuid: String): ActivityEntity?

    @Query("UPDATE activities SET status = 'uploaded', serverId = :serverId WHERE clientUuid = :uuid")
    suspend fun markUploaded(uuid: String, serverId: Long?)

    @Delete
    suspend fun delete(a: ActivityEntity)
}
