' add things to three
print 1 + 2
print 1& + 2&
print 1! + 2e0
print 1d0 + 2d0

' subtract to five
print 7 - 2
print 7& - 2
print 7! - 2d0
print 7d0 - 2&

' multiply to 15
print 3 * 5
print 3& * 5!
print 3! * 5&
print 3d0 * 5

' divide to 2.5
print 5 / 2
print 5& / 2& ' divides to 2 -- might not match on-device behavior
print 5! / 2e0
print 5d0 / 2d0

' exponentiate to 8
print 2 ^ 3
print 2& ^ 3&
print 2! ^ 3!
print 2d0 ^ 3d0

' bitshift operations
print 32 << 1
print 32 << 2
print 32 << 3
print 32 >> 1
print 32 >> 2
print 32 >> 3

' unary operations
print -5 ' => -5
print +5 ' => 5
print -+-+-+5 ' => -5

' modulo operations
print type(7.6 mod 3.0) 'Float
print 7.6 mod 3.0 ' 1
print type(7 mod 3.0) 'Float
print 7 mod 3.0 ' 1
print type(7.6 mod 3) 'Float
print 7.6 mod 3 ' 1
print type(7 mod 3) 'Integer
print 7 mod 3 ' 1
