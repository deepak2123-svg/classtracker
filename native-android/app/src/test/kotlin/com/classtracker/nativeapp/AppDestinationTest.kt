package com.classtracker.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppDestinationTest {
    @Test
    fun routesAreUnique() {
        val routes = AppDestination.entries.map { it.route }

        assertEquals(routes.size, routes.toSet().size)
    }

    @Test
    fun homeIsTheFirstDestination() {
        assertTrue(AppDestination.entries.first() == AppDestination.Home)
    }
}
