sub main()
    testArray()
    testAA()
end sub

sub testArray()
    print "testing roArray ifEnum"
    arr = [1,2,3]
    print "isNext Not Empty:"; arr.isNext()
    arr.clear()
    print "isEmpty:"; arr.isEmpty()
    print "isNext Empty:"; arr.isNext()
    arr.push("a")
    arr.push("b")
    arr.push("c")
    arr.push("d")
    print "isNext before Reset:"; arr.isNext()
    arr.reset()
    print "isNext after Reset:"; arr.isNext()
    for i = 1 to 3
        x = arr.next()
        print x
    next
    arr.unshift("x")
    print arr.next()
end sub

sub testAA()
    print "testing AA ifEnum"
    aa = {
        "a": 9
        "b": 5
        "c": 3
        "d": "string"
    }
    print "isNext before Reset:"; aa.isNext()
    aa.reset()
    print "isNext after Reset:"; aa.isNext()
    for i = 1 to 3
        x = aa.next()
        print x
    next
    aa.addReplace("9", 0)
    aa.addReplace("x", -10)
    x= aa.next()
    while x <> invalid
        print x
        x = aa.next()
    end while

    bb = {}
    print "isEmpty:"; bb.isNext()
    print "isNext Empty:"; bb.isNext()
    bb.addReplace("a", 10)
    bb.addReplace("b", -2)
    bb.addReplace("c", "core")
    bb.addReplace("d", 4.4)
    print "isNext before Reset:"; bb.isNext()
    bb.reset()
    print "isNext after Reset:"; bb.isNext()
    for i = 1 to 3
        x = bb.next()
        print x
    next
    bb.addReplace("x", -10)
    bb.addReplace("9", 0)
    print "Reset()"
    bb.reset()
    x = bb.next()
    while x <> invalid
        print x
        x = bb.next()
    end while
end sub
