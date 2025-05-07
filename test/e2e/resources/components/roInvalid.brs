sub main()
    r = createObject("RoInvalid")
    print type(r)
    print r
    print r.toStr()
    print r?.bar

    result = (r = invalid)
    print result
end sub
