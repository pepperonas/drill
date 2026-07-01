# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keep,includedescriptorclasses class io.celox.drillgo.net.**$$serializer { *; }
-keepclassmembers class io.celox.drillgo.net.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep @kotlinx.serialization.Serializable class io.celox.drillgo.net.** { *; }

# Retrofit / OkHttp (mostly covered by bundled consumer rules)
-keepattributes Signature, Exceptions
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**

# Room entities
-keep class io.celox.drillgo.data.db.** { *; }
